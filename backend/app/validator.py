"""Deterministic pre-generation validation checks."""

from collections import defaultdict
from sqlalchemy.orm import Session
from .models import CourseAssignment, Lecturer, Room, StudentGroup


def validate(db: Session) -> list[dict]:
    """
    Returns a list of issues: {severity, category, message, items?}
    severity: "error" | "warning" | "info"
    """
    issues: list[dict] = []

    lecturers   = db.query(Lecturer).all()
    rooms       = db.query(Room).all()
    groups      = db.query(StudentGroup).all()
    assignments = db.query(CourseAssignment).all()

    # ── Lecturers ──────────────────────────────────────────────────────────────

    no_avail = [l for l in lecturers if not l.availability]
    if no_avail:
        issues.append({
            "severity": "warning",
            "category": "Dostępność wykładowców",
            "message": (
                f"{len(no_avail)} z {len(lecturers)} wykładowców nie podało dostępności "
                "— zostaną zaplanowani w dowolnym terminie, co może utrudnić optymalizację."
            ),
            "items": [f"{l.title} {l.name}".strip() for l in no_avail],
        })

    # ── Assignments ────────────────────────────────────────────────────────────

    no_groups = [a for a in assignments if not a.groups]
    if no_groups:
        issues.append({
            "severity": "error",
            "category": "Przypisania bez grup",
            "message": (
                f"{len(no_groups)} przypisań nie ma przypisanej żadnej grupy "
                "— zostaną całkowicie pominięte przez scheduler."
            ),
            "items": [f"{a.course.name} / {a.lecturer.title} {a.lecturer.name}".strip()
                      for a in no_groups],
        })

    if not assignments:
        issues.append({
            "severity": "error",
            "category": "Brak przypisań",
            "message": "Nie ma żadnych przypisań zajęć — generowanie planu nie jest możliwe.",
        })

    # ── Rooms ──────────────────────────────────────────────────────────────────

    if not rooms:
        issues.append({
            "severity": "error",
            "category": "Brak sal",
            "message": "Nie dodano żadnych sal — generowanie planu nie jest możliwe.",
        })

    # Check each assignment/group pair for room feasibility
    room_mismatches: list[str] = []
    for a in assignments:
        for g in a.groups:
            needed = max(g.size, a.course.min_room_capacity)
            ok = any(
                r.capacity >= needed
                and all(f in (r.features or []) for f in (a.course.required_features or []))
                for r in rooms
            )
            if not ok and not a.course.can_be_online:
                room_mismatches.append(
                    f"{a.course.name} / {g.name} "
                    f"(poj. ≥ {needed}"
                    + (f", wyposażenie: {a.course.required_features}" if a.course.required_features else "")
                    + ")"
                )

    if room_mismatches:
        issues.append({
            "severity": "error",
            "category": "Brak odpowiedniej sali",
            "message": (
                f"{len(room_mismatches)} par (przypisanie, grupa) nie ma pasującej sali "
                "i kurs nie może być realizowany online."
            ),
            "items": room_mismatches,
        })

    # ── Capacity / workload ────────────────────────────────────────────────────

    total_needed = sum(len(a.groups) * a.sessions_per_week for a in assignments)
    total_avail  = len(rooms) * 5 * 5  # rooms × days × blocks
    if total_needed > 0 and total_avail > 0:
        fill = total_needed / total_avail
        if fill > 1.0:
            issues.append({
                "severity": "error",
                "category": "Przepełnienie harmonogramu",
                "message": (
                    f"Potrzeba {total_needed} slotów, dostępnych {total_avail} "
                    f"({fill*100:.0f}% — plan matematycznie niemożliwy do ułożenia)."
                ),
            })
        elif fill > 0.75:
            issues.append({
                "severity": "warning",
                "category": "Wysokie obciążenie sal",
                "message": (
                    f"Potrzeba {total_needed} slotów przy {total_avail} dostępnych "
                    f"({fill*100:.0f}% wypełnienia) — solver może mieć trudności."
                ),
            })

    # ── Lecturer workload vs availability ──────────────────────────────────────

    lect_sessions: dict[int, int] = defaultdict(int)
    for a in assignments:
        lect_sessions[a.lecturer_id] += len(a.groups) * a.sessions_per_week

    overloaded: list[str] = []
    for l in lecturers:
        sessions = lect_sessions.get(l.id, 0)
        if sessions == 0:
            continue
        avail_blocks = sum(len(s.get("blocks", [])) for s in (l.availability or []))
        if avail_blocks > 0 and sessions > avail_blocks:
            overloaded.append(
                f"{l.title} {l.name}".strip()
                + f": {sessions} sesji, tylko {avail_blocks} dostępnych bloków"
            )

    if overloaded:
        issues.append({
            "severity": "error",
            "category": "Przeciążeni wykładowcy",
            "message": (
                f"{len(overloaded)} wykładowców ma więcej sesji niż dostępnych bloków "
                "— plan nie może być ułożony bez naruszenia ich dostępności."
            ),
            "items": overloaded,
        })

    # ── Courses missing lecturer ───────────────────────────────────────────────

    courses_no_assignment = []
    assigned_course_ids = {a.course_id for a in assignments}
    from .models import Course
    all_courses = db.query(Course).all()
    for c in all_courses:
        if c.id not in assigned_course_ids:
            courses_no_assignment.append(c.name)

    if courses_no_assignment:
        issues.append({
            "severity": "info",
            "category": "Przedmioty bez przypisania",
            "message": (
                f"{len(courses_no_assignment)} przedmiotów nie ma żadnego przypisania "
                "i nie pojawi się w planie."
            ),
            "items": courses_no_assignment,
        })

    return issues
