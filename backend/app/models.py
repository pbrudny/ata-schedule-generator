import uuid
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table, Text, JSON
from sqlalchemy.orm import relationship

from .database import Base


lecturer_courses = Table(
    "lecturer_courses",
    Base.metadata,
    Column("lecturer_id", Integer, ForeignKey("lecturers.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id",   Integer, ForeignKey("courses.id",   ondelete="CASCADE"), primary_key=True),
)

assignment_groups = Table(
    "assignment_groups",
    Base.metadata,
    Column("assignment_id", Integer, ForeignKey("course_assignments.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id",      Integer, ForeignKey("student_groups.id",     ondelete="CASCADE"), primary_key=True),
)


class Lecturer(Base):
    __tablename__ = "lecturers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    title = Column(String(50), default="")
    # [{day: 0, blocks: [1,2,3,4,5]}, ...] — day 0=Pon..4=Pt, 5=Sob, 6=Nd
    availability = Column(JSON, default=list)
    preferences = Column(Text, default="")
    public_token = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))

    can_teach = relationship("Course", secondary=lecturer_courses, lazy="select")
    assignments = relationship("CourseAssignment", back_populates="lecturer")
    schedule_entries = relationship("ScheduleEntry", back_populates="lecturer")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    capacity = Column(Integer, nullable=False)
    building = Column(String(100), default="")
    # e.g. ["projektor", "tablica", "lab_komputerowe", "klimatyzacja"]
    features = Column(JSON, default=list)

    schedule_entries = relationship("ScheduleEntry", back_populates="room")


class StudentGroup(Base):
    __tablename__ = "student_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    size = Column(Integer, nullable=False)
    semester = Column(Integer, default=1)
    intake_season = Column(String(10), default="zimowy")
    study_mode = Column(String(50), default="stacjonarne")

    schedule_entries = relationship("ScheduleEntry", back_populates="group")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    # wykład, ćwiczenia, laboratorium, seminarium
    type = Column(String(100), default="wykład")
    priority = Column(Integer, default=1)
    required_features = Column(JSON, default=list)
    min_room_capacity = Column(Integer, default=0)
    can_be_online = Column(Boolean, default=False)
    half_semester = Column(Boolean, default=False)
    all_groups_together = Column(Boolean, default=False)

    assignments = relationship("CourseAssignment", back_populates="course")


class CourseAssignment(Base):
    """Defines what must be scheduled: which lecturer teaches which course to which groups."""

    __tablename__ = "course_assignments"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    lecturer_id = Column(Integer, ForeignKey("lecturers.id"), nullable=False)
    sessions_per_week = Column(Integer, default=1)
    blocks_per_session = Column(Integer, default=1)

    course = relationship("Course", back_populates="assignments")
    lecturer = relationship("Lecturer", back_populates="assignments")
    groups = relationship("StudentGroup", secondary=assignment_groups, lazy="select")
    schedule_entries = relationship("ScheduleEntry", back_populates="assignment")


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("course_assignments.id"), nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    lecturer_id = Column(Integer, ForeignKey("lecturers.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("student_groups.id"), nullable=False)
    # 0=Pon, 1=Wt, 2=Śr, 3=Czw, 4=Pt, 5=Sob, 6=Nd
    day = Column(Integer, nullable=False)
    block_start = Column(Integer, nullable=False)  # 1–5
    block_end = Column(Integer, nullable=False)    # 1–5 inclusive

    is_manual = Column(Boolean, default=False)

    assignment = relationship("CourseAssignment", back_populates="schedule_entries")
    course = relationship("Course")
    lecturer = relationship("Lecturer", back_populates="schedule_entries")
    room = relationship("Room", back_populates="schedule_entries")
    group = relationship("StudentGroup", back_populates="schedule_entries")
