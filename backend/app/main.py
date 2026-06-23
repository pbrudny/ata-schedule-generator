import json
import os
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi import APIRouter
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.orm import Session
from typing import Optional

from .database import Base, engine, get_db
from .models import (
    Course,
    CourseAssignment,
    GenerationAttempt,
    Lecturer,
    Room,
    ScheduleEntry,
    StudentGroup,
)
from .schemas import (
    AvailabilityPublicOut,
    AvailabilitySubmit,
    CourseAssignmentCreate,
    CourseAssignmentOut,
    CourseAssignmentUpdate,
    CourseCreate,
    CourseOut,
    CourseUpdate,
    GenerateResult,
    GenerationAttemptNotesUpdate,
    GenerationAttemptOut,
    LecturerCreate,
    LecturerOut,
    LecturerUpdate,
    RoomCreate,
    RoomOut,
    RoomUpdate,
    ScheduleEntryCreate,
    ScheduleEntryOut,
    ScheduleEntryUpdate,
    StudentGroupCreate,
    StudentGroupOut,
    StudentGroupUpdate,
)
from .scheduler import generate_schedule
from .llm import suggest_adjustments, stream_pre_analysis

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ATA Generator Planu Zajęć")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


# ── Lecturers ─────────────────────────────────────────────────────────────────

@router.get("/lecturers", response_model=list[LecturerOut])
def list_lecturers(db: Session = Depends(get_db)):
    return db.query(Lecturer).order_by(Lecturer.name).all()


@router.post("/lecturers", response_model=LecturerOut, status_code=201)
def create_lecturer(body: LecturerCreate, db: Session = Depends(get_db)):
    obj = Lecturer(**body.model_dump(exclude={"course_ids"}))
    if body.course_ids:
        obj.can_teach = db.query(Course).filter(Course.id.in_(body.course_ids)).all()
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/lecturers/{lecturer_id}", response_model=LecturerOut)
def get_lecturer(lecturer_id: int, db: Session = Depends(get_db)):
    obj = db.get(Lecturer, lecturer_id)
    if not obj:
        raise HTTPException(404, "Wykładowca nie istnieje")
    return obj


@router.put("/lecturers/{lecturer_id}", response_model=LecturerOut)
def update_lecturer(lecturer_id: int, body: LecturerUpdate, db: Session = Depends(get_db)):
    obj = db.get(Lecturer, lecturer_id)
    if not obj:
        raise HTTPException(404, "Wykładowca nie istnieje")
    for k, v in body.model_dump(exclude_none=True, exclude={"course_ids"}).items():
        setattr(obj, k, v)
    if body.course_ids is not None:
        obj.can_teach = db.query(Course).filter(Course.id.in_(body.course_ids)).all()
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/lecturers/{lecturer_id}", status_code=204)
def delete_lecturer(lecturer_id: int, db: Session = Depends(get_db)):
    obj = db.get(Lecturer, lecturer_id)
    if not obj:
        raise HTTPException(404, "Wykładowca nie istnieje")
    db.delete(obj)
    db.commit()


# ── Rooms ─────────────────────────────────────────────────────────────────────

@router.get("/rooms", response_model=list[RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(Room).order_by(Room.name).all()


@router.post("/rooms", response_model=RoomOut, status_code=201)
def create_room(body: RoomCreate, db: Session = Depends(get_db)):
    obj = Room(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/rooms/{room_id}", response_model=RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db)):
    obj = db.get(Room, room_id)
    if not obj:
        raise HTTPException(404, "Sala nie istnieje")
    return obj


@router.put("/rooms/{room_id}", response_model=RoomOut)
def update_room(room_id: int, body: RoomUpdate, db: Session = Depends(get_db)):
    obj = db.get(Room, room_id)
    if not obj:
        raise HTTPException(404, "Sala nie istnieje")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    obj = db.get(Room, room_id)
    if not obj:
        raise HTTPException(404, "Sala nie istnieje")
    db.delete(obj)
    db.commit()


# ── Student Groups ────────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[StudentGroupOut])
def list_groups(db: Session = Depends(get_db)):
    return db.query(StudentGroup).order_by(StudentGroup.name).all()


@router.post("/groups", response_model=StudentGroupOut, status_code=201)
def create_group(body: StudentGroupCreate, db: Session = Depends(get_db)):
    obj = StudentGroup(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/groups/{group_id}", response_model=StudentGroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    obj = db.get(StudentGroup, group_id)
    if not obj:
        raise HTTPException(404, "Grupa nie istnieje")
    return obj


@router.put("/groups/{group_id}", response_model=StudentGroupOut)
def update_group(group_id: int, body: StudentGroupUpdate, db: Session = Depends(get_db)):
    obj = db.get(StudentGroup, group_id)
    if not obj:
        raise HTTPException(404, "Grupa nie istnieje")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    obj = db.get(StudentGroup, group_id)
    if not obj:
        raise HTTPException(404, "Grupa nie istnieje")
    db.delete(obj)
    db.commit()


# ── Courses ───────────────────────────────────────────────────────────────────

@router.get("/courses", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(Course).order_by(Course.name).all()


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db)):
    obj = Course(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    obj = db.get(Course, course_id)
    if not obj:
        raise HTTPException(404, "Przedmiot nie istnieje")
    return obj


@router.put("/courses/{course_id}", response_model=CourseOut)
def update_course(course_id: int, body: CourseUpdate, db: Session = Depends(get_db)):
    obj = db.get(Course, course_id)
    if not obj:
        raise HTTPException(404, "Przedmiot nie istnieje")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    obj = db.get(Course, course_id)
    if not obj:
        raise HTTPException(404, "Przedmiot nie istnieje")
    db.delete(obj)
    db.commit()


# ── Course Assignments ────────────────────────────────────────────────────────

@router.get("/assignments", response_model=list[CourseAssignmentOut])
def list_assignments(db: Session = Depends(get_db)):
    return db.query(CourseAssignment).all()


@router.post("/assignments", response_model=CourseAssignmentOut, status_code=201)
def create_assignment(body: CourseAssignmentCreate, db: Session = Depends(get_db)):
    obj = CourseAssignment(**body.model_dump(exclude={"group_ids"}), blocks_per_session=1)
    if body.group_ids:
        obj.groups = db.query(StudentGroup).filter(StudentGroup.id.in_(body.group_ids)).all()
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/assignments/{assignment_id}", response_model=CourseAssignmentOut)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    obj = db.get(CourseAssignment, assignment_id)
    if not obj:
        raise HTTPException(404, "Przypisanie nie istnieje")
    return obj


@router.put("/assignments/{assignment_id}", response_model=CourseAssignmentOut)
def update_assignment(assignment_id: int, body: CourseAssignmentUpdate, db: Session = Depends(get_db)):
    obj = db.get(CourseAssignment, assignment_id)
    if not obj:
        raise HTTPException(404, "Przypisanie nie istnieje")
    for k, v in body.model_dump(exclude_none=True, exclude={"group_ids"}).items():
        setattr(obj, k, v)
    if body.group_ids is not None:
        obj.groups = db.query(StudentGroup).filter(StudentGroup.id.in_(body.group_ids)).all()
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    obj = db.get(CourseAssignment, assignment_id)
    if not obj:
        raise HTTPException(404, "Przypisanie nie istnieje")
    db.delete(obj)
    db.commit()


# ── Schedule ──────────────────────────────────────────────────────────────────

@router.get("/schedule", response_model=list[ScheduleEntryOut])
def list_schedule(
    group_id: Optional[int] = None,
    lecturer_id: Optional[int] = None,
    room_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ScheduleEntry)
    if group_id is not None:
        q = q.filter(ScheduleEntry.group_id == group_id)
    if lecturer_id is not None:
        q = q.filter(ScheduleEntry.lecturer_id == lecturer_id)
    if room_id is not None:
        q = q.filter(ScheduleEntry.room_id == room_id)
    return q.order_by(ScheduleEntry.day, ScheduleEntry.block_start).all()


@router.post("/schedule", response_model=ScheduleEntryOut, status_code=201)
def create_entry(body: ScheduleEntryCreate, db: Session = Depends(get_db)):
    obj = ScheduleEntry(**body.model_dump(), is_manual=True)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/schedule/{entry_id}", response_model=ScheduleEntryOut)
def update_entry(entry_id: int, body: ScheduleEntryUpdate, db: Session = Depends(get_db)):
    obj = db.get(ScheduleEntry, entry_id)
    if not obj:
        raise HTTPException(404, "Wpis nie istnieje")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    obj.is_manual = True
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/schedule/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    obj = db.get(ScheduleEntry, entry_id)
    if not obj:
        raise HTTPException(404, "Wpis nie istnieje")
    db.delete(obj)
    db.commit()


@router.post("/schedule/generate/stream")
def stream_generate(db: Session = Depends(get_db)):
    all_assignments = db.query(CourseAssignment).all()
    all_rooms = db.query(Room).all()

    llm_context = {
        "lecturers_count": db.query(Lecturer).count(),
        "rooms_count": len(all_rooms),
        "assignments_count": len(all_assignments),
        "total_slots_needed": sum(len(a.groups) * a.sessions_per_week for a in all_assignments),
        "restricted_lecturers_count": sum(1 for a in all_assignments if a.lecturer.availability),
        "assignment_details": [
            {
                "course": a.course.name,
                "type": a.course.type,
                "lecturer": f"{a.lecturer.title} {a.lecturer.name}".strip(),
                "groups": [g.name for g in a.groups],
                "sessions_per_week": a.sessions_per_week,
            }
            for a in all_assignments
        ],
    }

    snapshot = {
        "lecturers_count": llm_context["lecturers_count"],
        "rooms_count": llm_context["rooms_count"],
        "groups_count": db.query(StudentGroup).count(),
        "assignments_count": llm_context["assignments_count"],
    }

    def event_stream():
        thinking_chunks: list[str] = []

        # Phase 1: LLM pre-analysis (streamed)
        try:
            for chunk in stream_pre_analysis(llm_context):
                thinking_chunks.append(chunk)
                yield f"data: {json.dumps({'type': 'thinking', 'text': chunk})}\n\n"
        except Exception as exc:
            thinking_chunks.append(f"[Analiza niedostępna: {exc}]")
            yield f"data: {json.dumps({'type': 'thinking', 'text': thinking_chunks[-1]})}\n\n"

        # Phase 2: OR-Tools solver
        yield f"data: {json.dumps({'type': 'solving'})}\n\n"
        count, conflicts = generate_schedule(db)

        online_count = db.query(ScheduleEntry).filter(
            ScheduleEntry.is_manual == False,  # noqa: E712
            ScheduleEntry.room_id == None,  # noqa: E711
        ).count()

        # Phase 3: LLM suggestions on failure
        suggestions = None
        if conflicts or count == 0:
            solver_context = {
                "lecturers": snapshot["lecturers_count"],
                "rooms": snapshot["rooms_count"],
                "groups": snapshot["groups_count"],
                "assignments": snapshot["assignments_count"],
                "available_slots": snapshot["rooms_count"] * 5 * 5,
                "online_capable_courses": [
                    a.course.name for a in all_assignments if a.course.can_be_online
                ],
            }
            try:
                suggestions = suggest_adjustments(conflicts, solver_context)
            except Exception:
                pass

        # Save attempt
        attempt = GenerationAttempt(
            success=(count > 0 and not conflicts),
            entries_count=count,
            online_count=online_count,
            conflicts=conflicts,
            thinking="".join(thinking_chunks),
            suggestions=suggestions or "",
            **snapshot,
        )
        db.add(attempt)
        db.commit()

        yield f"data: {json.dumps({'type': 'result', 'entries_count': count, 'conflicts': conflicts, 'suggestions': suggestions})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/schedule/generate", response_model=GenerateResult)
def run_generate(db: Session = Depends(get_db)):
    n_lecturers = db.query(Lecturer).count()
    n_rooms = db.query(Room).count()
    n_groups = db.query(StudentGroup).count()
    n_assignments = db.query(CourseAssignment).count()

    count, conflicts = generate_schedule(db)

    online_count = db.query(ScheduleEntry).filter(
        ScheduleEntry.is_manual == False,  # noqa: E712
        ScheduleEntry.room_id == None,     # noqa: E711
    ).count()

    suggestions = None
    if conflicts or count == 0:
        context = {
            "lecturers": n_lecturers, "rooms": n_rooms,
            "groups": n_groups, "assignments": n_assignments,
            "available_slots": n_rooms * 5 * 5,
            "online_capable_courses": [
                a.course.name for a in db.query(CourseAssignment).all() if a.course.can_be_online
            ],
        }
        try:
            suggestions = suggest_adjustments(conflicts, context)
        except Exception:
            pass

    attempt = GenerationAttempt(
        success=(count > 0 and not conflicts),
        entries_count=count, online_count=online_count,
        conflicts=conflicts, suggestions=suggestions or "",
        lecturers_count=n_lecturers, rooms_count=n_rooms,
        groups_count=n_groups, assignments_count=n_assignments,
    )
    db.add(attempt)
    db.commit()

    return GenerateResult(entries_count=count, conflicts=conflicts, suggestions=suggestions)


@router.delete("/schedule/clear", status_code=204)
def clear_schedule(db: Session = Depends(get_db)):
    db.query(ScheduleEntry).filter(ScheduleEntry.is_manual == False).delete()  # noqa: E712
    db.commit()


# ── Generation history ────────────────────────────────────────────────────────

@router.get("/generation-history", response_model=list[GenerationAttemptOut])
def list_generation_history(db: Session = Depends(get_db)):
    return db.query(GenerationAttempt).order_by(GenerationAttempt.created_at.desc()).all()


@router.get("/generation-history/{attempt_id}", response_model=GenerationAttemptOut)
def get_generation_attempt(attempt_id: int, db: Session = Depends(get_db)):
    obj = db.get(GenerationAttempt, attempt_id)
    if not obj:
        raise HTTPException(404, "Próba generowania nie istnieje")
    return obj


@router.patch("/generation-history/{attempt_id}", response_model=GenerationAttemptOut)
def update_attempt_notes(attempt_id: int, body: GenerationAttemptNotesUpdate, db: Session = Depends(get_db)):
    obj = db.get(GenerationAttempt, attempt_id)
    if not obj:
        raise HTTPException(404, "Próba generowania nie istnieje")
    obj.notes = body.notes
    db.commit()
    db.refresh(obj)
    return obj


# ── Public availability form (no auth) ───────────────────────────────────────

@router.get("/availability/{token}", response_model=AvailabilityPublicOut)
def get_availability(token: str, db: Session = Depends(get_db)):
    obj = db.query(Lecturer).filter(Lecturer.public_token == token).first()
    if not obj:
        raise HTTPException(404, "Nie znaleziono wykładowcy")
    return obj


@router.put("/availability/{token}", response_model=AvailabilityPublicOut)
def submit_availability(token: str, body: AvailabilitySubmit, db: Session = Depends(get_db)):
    obj = db.query(Lecturer).filter(Lecturer.public_token == token).first()
    if not obj:
        raise HTTPException(404, "Nie znaleziono wykładowcy")
    obj.availability = body.availability
    obj.preferences = body.preferences
    db.commit()
    db.refresh(obj)
    return obj


app.include_router(router)

# Serve React SPA — must come after API router
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 404 and not request.url.path.startswith("/api"):
            index = os.path.join(static_dir, "index.html")
            if os.path.isfile(index):
                return FileResponse(index)
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
