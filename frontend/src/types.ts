export interface Lecturer {
  id: number;
  name: string;
  email: string;
  title: string;
  availability: AvailabilitySlot[];
  preferences: string;
  public_token: string | null;
  can_teach: Course[];
}

export interface AvailabilitySlot {
  day: number; // 0=Pon..4=Pt
  blocks: number[]; // 1..5
}

export interface Room {
  id: number;
  name: string;
  capacity: number;
  building: string;
  features: string[];
}

export interface StudentGroup {
  id: number;
  name: string;
  size: number;
  semester: number;
  intake_season: string;
  study_mode: string;
}

export interface Course {
  id: number;
  name: string;
  type: string;
  priority: number;
  required_features: string[];
  min_room_capacity: number;
  can_be_online: boolean;
  half_semester: boolean;
  all_groups_together: boolean;
}

export interface CourseAssignment {
  id: number;
  course_id: number;
  lecturer_id: number;
  group_id: number;
  sessions_per_week: number;
  blocks_per_session: number;
  course: Course;
  lecturer: Lecturer;
  group: StudentGroup;
}

export interface ScheduleEntry {
  id: number;
  course_id: number;
  lecturer_id: number;
  room_id: number;
  group_id: number;
  day: number;
  block_start: number;
  block_end: number;
  is_manual: boolean;
  assignment_id: number | null;
  course: Course;
  lecturer: Lecturer;
  room: Room;
  group: StudentGroup;
}

export const DAYS_PL = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"];
export const DAYS_SHORT = ["Pon", "Wt", "Śr", "Czw", "Pt"];

export const BLOCK_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:00", end: "09:40" },
  2: { start: "09:50", end: "11:30" },
  3: { start: "11:40", end: "13:20" },
  4: { start: "13:30", end: "15:10" },
  5: { start: "15:20", end: "17:00" },
};

export const COURSE_TYPES = ["wykład", "ćwiczenia", "laboratorium", "seminarium"];
export const STUDY_MODES = ["stacjonarne", "niestacjonarne"];
export const INTAKE_SEASONS = ["zimowy", "letni"];
export const ROOM_FEATURES = ["projektor", "tablica", "lab_komputerowe", "klimatyzacja", "nagłośnienie"];

// Fixed reference week for FullCalendar (Monday = 2025-01-06)
export function entryToDate(day: number): string {
  return `2025-01-${String(day + 6).padStart(2, "0")}`; // 0→06(Mon)…4→10(Fri)
}
