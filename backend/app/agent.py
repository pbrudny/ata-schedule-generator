"""Agentic schedule solver using OpenAI function calling."""

import json
import os
from typing import Generator
from openai import OpenAI

from sqlalchemy.orm import Session
from .models import Course, CourseAssignment, Room, ScheduleEntry, StudentGroup
from .scheduler import generate_schedule

_client: OpenAI | None = None

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_schedule_state",
            "description": "Pobierz aktualny stan danych: przypisania z ID, wykładowców, sale, ostatnie konflikty",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_scheduler",
            "description": "Uruchom solver OR-Tools i zwróć wynik (liczba wpisów, konflikty)",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "mark_courses_online",
            "description": "Oznacz kursy jako możliwe do realizacji online — eliminuje ograniczenia salowe dla tych kursów",
            "parameters": {
                "type": "object",
                "properties": {
                    "course_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "ID kursów do oznaczenia jako online",
                    }
                },
                "required": ["course_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_assignment",
            "description": "Usuń przypisanie zajęć (stosuj tylko gdy nie ma innego wyjścia — kurs bez możliwości sali i bez opcji online)",
            "parameters": {
                "type": "object",
                "properties": {
                    "assignment_id": {"type": "integer", "description": "ID przypisania do usunięcia"},
                    "reason":        {"type": "string",  "description": "Krótkie uzasadnienie po polsku"},
                },
                "required": ["assignment_id", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "finish",
            "description": "Zakończ pracę agenta i podsumuj wyniki",
            "parameters": {
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"},
                    "summary": {"type": "string", "description": "Podsumowanie działań i wyników po polsku"},
                },
                "required": ["success", "summary"],
            },
        },
    },
]

SYSTEM_PROMPT = """Jesteś agentem naprawiającym plan zajęć uczelni wyższej.

STRATEGIA (od najmniej do najbardziej inwazyjnej):
1. Zacznij od run_scheduler — sprawdź czy problem faktycznie istnieje.
2. Jeśli sukces — wywołaj finish(success=true).
3. Jeśli błąd — użyj get_schedule_state, żeby zrozumieć przyczyny.
4. Spróbuj mark_courses_online dla kursów z can_be_online=false które blokują plan (kursy online nie zajmują sal).
5. Jako ostateczność usuń remove_assignment dla przypisań bez możliwej sali i bez opcji online — preferuj te o najniższym priorytecie.
6. Po każdej zmianie uruchom run_scheduler ponownie.
7. Jeśli wyczerpałeś możliwości — wywołaj finish(success=false) z wyjaśnieniem.

Używaj polskiego w uzasadnieniach. Nie pytaj o potwierdzenie — podejmuj decyzje autonomicznie."""

MAX_ITERATIONS = 8


class AgentSession:
    def __init__(self, db: Session):
        self.db = db
        self.changes: list[dict] = []
        self.last_conflicts: list[str] = []
        self.entries_count: int = 0

    def get_state(self) -> str:
        assignments = self.db.query(CourseAssignment).all()
        rooms       = self.db.query(Room).all()

        total_needed = sum(len(a.groups) * a.sessions_per_week for a in assignments)
        total_avail  = len(rooms) * 25

        lines = [
            f"SALE: {len(rooms)} (łącznie {total_avail} slotów/tydzień)",
            f"POTRZEBNYCH SLOTÓW: {total_needed} ({total_needed/max(total_avail,1)*100:.0f}% pojemności)",
            "",
            "PRZYPISANIA (id | kurs | typ | priorytet | wykładowca | grupy | sesji/tydz | online?):",
        ]
        for a in assignments:
            groups_str = ", ".join(g.name for g in a.groups[:4])
            if len(a.groups) > 4:
                groups_str += f" +{len(a.groups)-4}"
            # check room feasibility
            max_size = max((g.size for g in a.groups), default=0)
            needed = max(max_size, a.course.min_room_capacity)
            has_room = any(
                r.capacity >= needed and all(f in (r.features or []) for f in (a.course.required_features or []))
                for r in rooms
            )
            room_flag = "OK" if has_room else ("ONLINE" if a.course.can_be_online else "BRAK_SALI")
            lines.append(
                f"  id={a.id} | {a.course.name} | {a.course.type} | prio={a.course.priority}"
                f" | {a.lecturer.title} {a.lecturer.name} | [{groups_str}]"
                f" | {a.sessions_per_week}× | online={a.course.can_be_online} | sala={room_flag}"
            )

        if self.last_conflicts:
            lines += ["", "OSTATNIE KONFLIKTY:", *[f"  - {c}" for c in self.last_conflicts]]

        return "\n".join(lines)

    def run_scheduler(self) -> str:
        count, conflicts = generate_schedule(self.db)
        self.last_conflicts = conflicts
        self.entries_count  = count
        if count > 0 and not conflicts:
            return f"SUKCES: wygenerowano {count} wpisów planu."
        return "NIEPOWODZENIE: " + ("; ".join(conflicts) if conflicts else "brak wpisów")

    def mark_courses_online(self, course_ids: list[int]) -> str:
        courses = self.db.query(Course).filter(Course.id.in_(course_ids)).all()
        changed: list[str] = []
        for c in courses:
            if not c.can_be_online:
                self.changes.append({
                    "type": "mark_online",
                    "course_id": c.id,
                    "label": c.name,
                    "was": False,
                })
                c.can_be_online = True
                changed.append(c.name)
        self.db.commit()
        return f"Oznaczono jako online: {', '.join(changed) or 'żaden (już były online)'}"

    def remove_assignment(self, assignment_id: int, reason: str) -> str:
        a = self.db.get(CourseAssignment, assignment_id)
        if not a:
            return f"Przypisanie {assignment_id} nie istnieje."
        label = f"{a.course.name} / {a.lecturer.title} {a.lecturer.name}".strip()
        self.changes.append({
            "type": "remove_assignment",
            "label": label,
            "reason": reason,
            "data": {
                "course_id":        a.course_id,
                "lecturer_id":      a.lecturer_id,
                "group_ids":        [g.id for g in a.groups],
                "sessions_per_week": a.sessions_per_week,
                "blocks_per_session": a.blocks_per_session,
            },
        })
        self.db.delete(a)
        self.db.commit()
        return f"Usunięto: {label} ({reason})"

    def revert(self):
        for change in reversed(self.changes):
            if change["type"] == "mark_online":
                c = self.db.get(Course, change["course_id"])
                if c:
                    c.can_be_online = change["was"]
            elif change["type"] == "remove_assignment":
                d = change["data"]
                a = CourseAssignment(
                    course_id=d["course_id"],
                    lecturer_id=d["lecturer_id"],
                    sessions_per_week=d["sessions_per_week"],
                    blocks_per_session=d["blocks_per_session"],
                )
                a.groups = self.db.query(StudentGroup).filter(
                    StudentGroup.id.in_(d["group_ids"])
                ).all()
                self.db.add(a)
        self.db.query(ScheduleEntry).filter(ScheduleEntry.is_manual == False).delete()  # noqa: E712
        self.db.commit()

    def execute(self, name: str, args: dict) -> str:
        if name == "get_schedule_state":
            return self.get_state()
        if name == "run_scheduler":
            return self.run_scheduler()
        if name == "mark_courses_online":
            return self.mark_courses_online(args["course_ids"])
        if name == "remove_assignment":
            return self.remove_assignment(args["assignment_id"], args["reason"])
        if name == "finish":
            return args.get("summary", "")
        return f"Nieznane narzędzie: {name}"


def agent_solve_stream(db: Session) -> Generator[bytes, None, None]:
    session  = AgentSession(db)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    def emit(obj: dict) -> bytes:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode()

    for iteration in range(MAX_ITERATIONS):
        response = _get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS,
            tool_choice="required",
        )

        msg = response.choices[0].message
        messages.append(msg)

        # Surface any reasoning text before tool calls
        if msg.content:
            yield emit({"type": "thinking", "text": msg.content})

        if not msg.tool_calls:
            yield emit({
                "type": "done", "success": False,
                "summary": "Agent zakończył bez wywołania narzędzia finish.",
                "changes": session.changes, "entries_count": session.entries_count,
            })
            return

        for tc in msg.tool_calls:
            name = tc.function.name
            args = json.loads(tc.function.arguments)

            yield emit({"type": "step_start", "tool": name, "args": args})

            result = session.execute(name, args)

            yield emit({"type": "step_done", "tool": name, "result": result})

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

            if name == "finish":
                yield emit({
                    "type": "done",
                    "success": args.get("success", False),
                    "summary": args.get("summary", ""),
                    "changes": session.changes,
                    "entries_count": session.entries_count,
                })
                return

    # Exhausted iterations
    yield emit({
        "type": "done", "success": False,
        "summary": f"Agent wyczerpał limit {MAX_ITERATIONS} iteracji bez rozwiązania.",
        "changes": session.changes, "entries_count": session.entries_count,
    })
