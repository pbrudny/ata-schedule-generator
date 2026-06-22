"""OR-Tools CP-SAT scheduler for ATA class timetabling."""

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from .models import CourseAssignment, Room, ScheduleEntry

DAYS = 5  # Pon–Pt (0..4)
BLOCKS = 5  # bloki 1..5


def generate_schedule(db: Session) -> tuple[int, list[str]]:
    """
    Clears auto-generated entries and creates new ones via CP-SAT.
    Returns (number_of_entries_created, list_of_error_messages).
    """
    assignments = db.query(CourseAssignment).all()
    rooms = db.query(Room).all()

    if not assignments:
        return 0, ["Brak przypisań do zaplanowania. Dodaj przypisania zajęć."]
    if not rooms:
        return 0, ["Brak sal. Dodaj sale przed generowaniem planu."]

    model = cp_model.CpModel()

    # slot_vars[(a_idx, s)] = (day_var, block_var, room_var, end_var)
    slot_vars: dict = {}

    for a_idx, a in enumerate(assignments):
        max_start = BLOCKS - a.blocks_per_session + 1
        if max_start < 1:
            return 0, [
                f"Przypisanie {a.course.name} / {a.group.name}: "
                f"liczba bloków na sesję ({a.blocks_per_session}) przekracza dostępne bloki."
            ]

        # Which rooms are compatible for this assignment?
        valid_room_indices = [
            r_idx
            for r_idx, room in enumerate(rooms)
            if room.capacity >= max(a.group.size, a.course.min_room_capacity)
            and all(f in (room.features or []) for f in (a.course.required_features or []))
        ]
        if not valid_room_indices:
            return 0, [
                f"Brak odpowiedniej sali dla: {a.course.name} / {a.group.name} "
                f"(pojemność ≥ {a.group.size}, wyposażenie: {a.course.required_features})"
            ]

        for s in range(a.sessions_per_week):
            day_var = model.new_int_var(0, DAYS - 1, f"d_{a_idx}_{s}")
            block_var = model.new_int_var(1, max_start, f"b_{a_idx}_{s}")
            room_var = model.new_int_var(0, len(rooms) - 1, f"r_{a_idx}_{s}")
            end_var = model.new_int_var(2, BLOCKS + 1, f"e_{a_idx}_{s}")

            model.add(end_var == block_var + a.blocks_per_session)
            model.add_allowed_assignments([room_var], [[i] for i in valid_room_indices])

            # Lecturer availability: restrict (day, block_start) to allowed pairs
            avail = a.lecturer.availability or []
            if avail:
                allowed_pairs = [
                    (slot["day"], b)
                    for slot in avail
                    for b in slot.get("blocks", [])
                    if 0 <= slot["day"] < DAYS and 1 <= b <= max_start
                ]
                if allowed_pairs:
                    model.add_allowed_assignments([day_var, block_var], allowed_pairs)

            slot_vars[(a_idx, s)] = (day_var, block_var, room_var, end_var)

    # Build optional intervals for no-overlap constraints
    # lecturer_intervals[(lecturer_id, day)] and group/room equivalents
    lect_intervals: dict[tuple, list] = {}
    group_intervals: dict[tuple, list] = {}
    room_intervals: dict[tuple, list] = {}

    for a_idx, a in enumerate(assignments):
        for s in range(a.sessions_per_week):
            day_var, block_var, room_var, end_var = slot_vars[(a_idx, s)]
            dur = a.blocks_per_session

            for d in range(DAYS):
                is_day = model.new_bool_var(f"isday_{a_idx}_{s}_{d}")
                model.add(day_var == d).only_enforce_if(is_day)
                model.add(day_var != d).only_enforce_if(is_day.Not())

                lect_key = (a.lecturer_id, d)
                lect_intervals.setdefault(lect_key, []).append(
                    model.new_optional_interval_var(block_var, dur, end_var, is_day, f"li_{a_idx}_{s}_{d}")
                )

                grp_key = (a.group_id, d)
                group_intervals.setdefault(grp_key, []).append(
                    model.new_optional_interval_var(block_var, dur, end_var, is_day, f"gi_{a_idx}_{s}_{d}")
                )

                for r_idx in range(len(rooms)):
                    is_room = model.new_bool_var(f"isrm_{a_idx}_{s}_{r_idx}")
                    model.add(room_var == r_idx).only_enforce_if(is_room)
                    model.add(room_var != r_idx).only_enforce_if(is_room.Not())

                    is_day_room = model.new_bool_var(f"isdr_{a_idx}_{s}_{d}_{r_idx}")
                    model.add_bool_and([is_day, is_room]).only_enforce_if(is_day_room)
                    model.add_bool_or([is_day.Not(), is_room.Not()]).only_enforce_if(is_day_room.Not())

                    rm_key = (r_idx, d)
                    room_intervals.setdefault(rm_key, []).append(
                        model.new_optional_interval_var(block_var, dur, end_var, is_day_room, f"ri_{a_idx}_{s}_{r_idx}_{d}")
                    )

    # No-overlap constraints
    for intervals in lect_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for intervals in group_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for intervals in room_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)

    # Multiple sessions of the same assignment must fall on different days
    for a_idx, a in enumerate(assignments):
        for s1 in range(a.sessions_per_week):
            for s2 in range(s1 + 1, a.sessions_per_week):
                model.add(slot_vars[(a_idx, s1)][0] != slot_vars[(a_idx, s2)][0])

    # Soft objective: minimize total block_start values (earlier = compacter days)
    total_blocks = []
    for a_idx, a in enumerate(assignments):
        for s in range(a.sessions_per_week):
            _, block_var, _, _ = slot_vars[(a_idx, s)]
            total_blocks.append(block_var)
    model.minimize(sum(total_blocks))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return 0, [
            "Nie udało się wygenerować planu. "
            "Sprawdź dostępność wykładowców, pojemność sal i liczbę przypisań."
        ]

    # Clear previous auto-generated entries and persist new ones
    db.query(ScheduleEntry).filter(ScheduleEntry.is_manual == False).delete()  # noqa: E712

    count = 0
    for a_idx, a in enumerate(assignments):
        for s in range(a.sessions_per_week):
            day_var, block_var, room_var, _ = slot_vars[(a_idx, s)]
            block_start = solver.value(block_var)
            entry = ScheduleEntry(
                assignment_id=a.id,
                course_id=a.course_id,
                lecturer_id=a.lecturer_id,
                room_id=rooms[solver.value(room_var)].id,
                group_id=a.group_id,
                day=solver.value(day_var),
                block_start=block_start,
                block_end=block_start + a.blocks_per_session - 1,
                is_manual=False,
            )
            db.add(entry)
            count += 1

    db.commit()
    return count, []
