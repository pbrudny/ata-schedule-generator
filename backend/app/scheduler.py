"""OR-Tools CP-SAT scheduler for ATA class timetabling."""

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from .models import CourseAssignment, Room, ScheduleEntry

DAYS = 5    # Pon–Pt (0..4)
BLOCKS = 5  # bloki 1..5
ONLINE = -1  # sentinel for virtual online "room"


def generate_schedule(db: Session) -> tuple[int, list[str]]:
    """
    Clears auto-generated entries and creates new ones via CP-SAT.
    Returns (number_of_entries_created, list_of_error_messages).
    Online-capable courses (can_be_online=True) may be scheduled without
    a physical room (room_id=None), freeing room slots for other classes.
    """
    assignments = db.query(CourseAssignment).all()
    rooms = db.query(Room).all()
    n_rooms = len(rooms)
    ONLINE_IDX = n_rooms  # virtual index beyond real room indices

    if not assignments:
        return 0, ["Brak przypisań do zaplanowania. Dodaj przypisania zajęć."]
    if not rooms:
        return 0, ["Brak sal. Dodaj sale przed generowaniem planu."]

    # Expand to flat task list: one task per (assignment, group, session)
    tasks: list[tuple] = []
    for a in assignments:
        for g in a.groups:
            for s in range(a.sessions_per_week):
                tasks.append((a, g, s))

    if not tasks:
        return 0, ["Przypisania nie mają przypisanych grup. Dodaj grupy do przypisań."]

    model = cp_model.CpModel()
    slot_vars: dict[int, tuple] = {}  # t_idx → (day_var, block_var, room_var, end_var)

    for t_idx, (a, g, s) in enumerate(tasks):
        max_start = BLOCKS - a.blocks_per_session + 1
        if max_start < 1:
            return 0, [
                f"Przypisanie {a.course.name} / {g.name}: "
                f"liczba bloków na sesję ({a.blocks_per_session}) przekracza dostępne bloki."
            ]

        physical_room_indices = [
            r_idx for r_idx, room in enumerate(rooms)
            if room.capacity >= max(g.size, a.course.min_room_capacity)
            and all(f in (room.features or []) for f in (a.course.required_features or []))
        ]

        if a.course.can_be_online:
            # Online courses can use any physical room OR go fully online (virtual slot)
            valid_room_indices = physical_room_indices + [ONLINE_IDX]
        else:
            valid_room_indices = physical_room_indices

        if not valid_room_indices:
            return 0, [
                f"Brak odpowiedniej sali dla: {a.course.name} / {g.name} "
                f"(pojemność ≥ {g.size}, wyposażenie: {a.course.required_features})"
            ]

        day_var   = model.new_int_var(0, DAYS - 1,  f"d_{t_idx}")
        block_var = model.new_int_var(1, max_start,  f"b_{t_idx}")
        room_var  = model.new_int_var(0, ONLINE_IDX, f"r_{t_idx}")
        end_var   = model.new_int_var(2, BLOCKS + 1, f"e_{t_idx}")

        model.add(end_var == block_var + a.blocks_per_session)
        model.add_allowed_assignments([room_var], [[i] for i in valid_room_indices])

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

        slot_vars[t_idx] = (day_var, block_var, room_var, end_var)

    # No-overlap constraints — online slots have no room constraint
    lect_intervals: dict[tuple, list] = {}
    group_intervals: dict[tuple, list] = {}
    room_intervals: dict[tuple, list] = {}

    for t_idx, (a, g, s) in enumerate(tasks):
        day_var, block_var, room_var, end_var = slot_vars[t_idx]
        dur = a.blocks_per_session

        for d in range(DAYS):
            is_day = model.new_bool_var(f"isday_{t_idx}_{d}")
            model.add(day_var == d).only_enforce_if(is_day)
            model.add(day_var != d).only_enforce_if(is_day.Not())

            lect_intervals.setdefault((a.lecturer_id, d), []).append(
                model.new_optional_interval_var(block_var, dur, end_var, is_day, f"li_{t_idx}_{d}")
            )
            group_intervals.setdefault((g.id, d), []).append(
                model.new_optional_interval_var(block_var, dur, end_var, is_day, f"gi_{t_idx}_{d}")
            )

            # Only enforce room no-overlap for physical rooms
            for r_idx in range(n_rooms):
                is_room = model.new_bool_var(f"isrm_{t_idx}_{r_idx}")
                model.add(room_var == r_idx).only_enforce_if(is_room)
                model.add(room_var != r_idx).only_enforce_if(is_room.Not())

                is_day_room = model.new_bool_var(f"isdr_{t_idx}_{d}_{r_idx}")
                model.add_bool_and([is_day, is_room]).only_enforce_if(is_day_room)
                model.add_bool_or([is_day.Not(), is_room.Not()]).only_enforce_if(is_day_room.Not())

                room_intervals.setdefault((r_idx, d), []).append(
                    model.new_optional_interval_var(block_var, dur, end_var, is_day_room, f"ri_{t_idx}_{d}_{r_idx}")
                )

    for intervals in lect_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for intervals in group_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for intervals in room_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)

    # Sessions of the same (assignment, group) must fall on different days
    task_key_indices: dict[tuple, list[int]] = {}
    for t_idx, (a, g, s) in enumerate(tasks):
        task_key_indices.setdefault((a.id, g.id), []).append(t_idx)
    for indices in task_key_indices.values():
        for i in range(len(indices)):
            for j in range(i + 1, len(indices)):
                model.add(slot_vars[indices[i]][0] != slot_vars[indices[j]][0])

    # Soft objective: pack to earlier blocks; prefer physical rooms over online
    block_terms = [slot_vars[t][1] for t in range(len(tasks))]
    # Small penalty for using the online slot (prefer physical when both available)
    online_terms = []
    for t_idx, (a, g, s) in enumerate(tasks):
        if a.course.can_be_online:
            is_online = model.new_bool_var(f"isonline_{t_idx}")
            room_var = slot_vars[t_idx][2]
            model.add(room_var == ONLINE_IDX).only_enforce_if(is_online)
            model.add(room_var != ONLINE_IDX).only_enforce_if(is_online.Not())
            online_terms.append(is_online)
    model.minimize(sum(block_terms) + 2 * sum(online_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return 0, [
            "Nie udało się wygenerować planu. "
            "Sprawdź dostępność wykładowców, pojemność sal i liczbę przypisań."
        ]

    db.query(ScheduleEntry).filter(ScheduleEntry.is_manual == False).delete()  # noqa: E712

    count = 0
    for t_idx, (a, g, s) in enumerate(tasks):
        day_var, block_var, room_var, _ = slot_vars[t_idx]
        block_start = solver.value(block_var)
        room_idx = solver.value(room_var)
        room_id = None if room_idx == ONLINE_IDX else rooms[room_idx].id

        entry = ScheduleEntry(
            assignment_id=a.id,
            course_id=a.course_id,
            lecturer_id=a.lecturer_id,
            room_id=room_id,
            group_id=g.id,
            day=solver.value(day_var),
            block_start=block_start,
            block_end=block_start + a.blocks_per_session - 1,
            is_manual=False,
        )
        db.add(entry)
        count += 1

    db.commit()
    return count, []
