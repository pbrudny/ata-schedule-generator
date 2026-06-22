import os
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import APIRouter
from sqlalchemy.orm import Session
from typing import Optional

from .database import Base, engine, get_db
from .models import (
    Course,
    CourseAssignment,
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
    obj = Lecturer(**body.model_dump())
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
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
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
    obj = CourseAssignment(**body.model_dump())
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
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
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


@router.post("/schedule/generate", response_model=GenerateResult)
def run_generate(db: Session = Depends(get_db)):
    count, conflicts = generate_schedule(db)
    return GenerateResult(entries_count=count, conflicts=conflicts)


@router.delete("/schedule/clear", status_code=204)
def clear_schedule(db: Session = Depends(get_db)):
    db.query(ScheduleEntry).filter(ScheduleEntry.is_manual == False).delete()  # noqa: E712
    db.commit()


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
