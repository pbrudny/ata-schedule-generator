from typing import Any, Optional
from pydantic import BaseModel


# ── Lecturer ──────────────────────────────────────────────────────────────────

class LecturerBase(BaseModel):
    name: str
    email: str
    title: str = ""
    availability: list[Any] = []
    preferences: str = ""


class LecturerCreate(LecturerBase):
    course_ids: list[int] = []


class LecturerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    title: Optional[str] = None
    availability: Optional[list[Any]] = None
    preferences: Optional[str] = None
    course_ids: Optional[list[int]] = None


class LecturerOut(LecturerBase):
    id: int
    public_token: Optional[str] = None
    can_teach: list["CourseOut"] = []
    model_config = {"from_attributes": True}


class AvailabilityPublicOut(BaseModel):
    name: str
    title: str
    availability: list[Any]
    preferences: str
    model_config = {"from_attributes": True}


class AvailabilitySubmit(BaseModel):
    availability: list[Any]
    preferences: str = ""


# ── Room ──────────────────────────────────────────────────────────────────────

class RoomBase(BaseModel):
    name: str
    capacity: int
    building: str = ""
    features: list[str] = []


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    building: Optional[str] = None
    features: Optional[list[str]] = None


class RoomOut(RoomBase):
    id: int
    model_config = {"from_attributes": True}


# ── StudentGroup ──────────────────────────────────────────────────────────────

class StudentGroupBase(BaseModel):
    name: str
    size: int
    semester: int = 1
    intake_season: str = "zimowy"
    study_mode: str = "stacjonarne"


class StudentGroupCreate(StudentGroupBase):
    pass


class StudentGroupUpdate(BaseModel):
    name: Optional[str] = None
    size: Optional[int] = None
    semester: Optional[int] = None
    intake_season: Optional[str] = None
    study_mode: Optional[str] = None


class StudentGroupOut(StudentGroupBase):
    id: int
    model_config = {"from_attributes": True}


# ── Course ────────────────────────────────────────────────────────────────────

class CourseBase(BaseModel):
    name: str
    type: str = "wykład"
    priority: int = 1
    required_features: list[str] = []
    min_room_capacity: int = 0
    can_be_online: bool = False
    half_semester: bool = False
    all_groups_together: bool = False


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[int] = None
    required_features: Optional[list[str]] = None
    min_room_capacity: Optional[int] = None
    can_be_online: Optional[bool] = None
    half_semester: Optional[bool] = None
    all_groups_together: Optional[bool] = None


class CourseOut(CourseBase):
    id: int
    model_config = {"from_attributes": True}


# ── CourseAssignment ──────────────────────────────────────────────────────────

class CourseAssignmentBase(BaseModel):
    course_id: int
    lecturer_id: int
    group_id: int
    sessions_per_week: int = 1


class CourseAssignmentCreate(CourseAssignmentBase):
    pass


class CourseAssignmentUpdate(BaseModel):
    course_id: Optional[int] = None
    lecturer_id: Optional[int] = None
    group_id: Optional[int] = None
    sessions_per_week: Optional[int] = None


class CourseAssignmentOut(CourseAssignmentBase):
    id: int
    course: CourseOut
    lecturer: LecturerOut
    group: StudentGroupOut
    model_config = {"from_attributes": True}


# ── ScheduleEntry ─────────────────────────────────────────────────────────────

class ScheduleEntryBase(BaseModel):
    course_id: int
    lecturer_id: int
    room_id: int
    group_id: int
    day: int
    block_start: int
    block_end: int
    assignment_id: Optional[int] = None
    is_manual: bool = False


class ScheduleEntryCreate(ScheduleEntryBase):
    pass


class ScheduleEntryUpdate(BaseModel):
    room_id: Optional[int] = None
    day: Optional[int] = None
    block_start: Optional[int] = None
    block_end: Optional[int] = None
    is_manual: Optional[bool] = None


class ScheduleEntryOut(ScheduleEntryBase):
    id: int
    course: CourseOut
    lecturer: LecturerOut
    room: RoomOut
    group: StudentGroupOut
    model_config = {"from_attributes": True}


# ── Schedule generation ───────────────────────────────────────────────────────

class GenerateResult(BaseModel):
    entries_count: int
    conflicts: list[str]
    suggestions: Optional[str] = None
