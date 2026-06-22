import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useEffect, useRef, useState } from "react";
import { groups as groupsApi, lecturers as lecturersApi, rooms as roomsApi, schedule as api } from "../api";
import {
  BLOCK_TIMES,
  DAYS_PL,
  Lecturer,
  Room,
  ScheduleEntry,
  StudentGroup,
  entryToDate,
} from "../types";

type FilterMode = "group" | "lecturer" | "room";

function entryToEvent(entry: ScheduleEntry) {
  const date = entryToDate(entry.day);
  const start = `${date}T${BLOCK_TIMES[entry.block_start].start}`;
  const end   = `${date}T${BLOCK_TIMES[entry.block_end].end}`;
  const color = entry.is_manual ? "#7c3aed" : "#2563eb";
  return {
    id: String(entry.id),
    title: `${entry.course.name}\n${entry.lecturer.title} ${entry.lecturer.name}\n${entry.room.name}`,
    start,
    end,
    backgroundColor: color,
    borderColor: color,
    extendedProps: { entry },
  };
}

export default function SchedulePage() {
  const [entries, setEntries]       = useState<ScheduleEntry[]>([]);
  const [groups, setGroups]         = useState<StudentGroup[]>([]);
  const [lecturers, setLecturers]   = useState<Lecturer[]>([]);
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("group");
  const [filterId, setFilterId]     = useState<number | "">("");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage]       = useState<{ type: "success" | "error"; text: string } | null>(null);
  const calRef = useRef<FullCalendar>(null);

  const loadMeta = async () => {
    const [g, l, r] = await Promise.all([
      groupsApi.list() as Promise<StudentGroup[]>,
      lecturersApi.list() as Promise<Lecturer[]>,
      roomsApi.list() as Promise<Room[]>,
    ]);
    setGroups(g); setLecturers(l); setRooms(r);
  };

  const loadSchedule = async () => {
    const params: Record<string, number> = {};
    if (filterId !== "") {
      if (filterMode === "group")    params.group_id    = filterId;
      if (filterMode === "lecturer") params.lecturer_id = filterId;
      if (filterMode === "room")     params.room_id     = filterId;
    }
    const data = await api.list(params) as ScheduleEntry[];
    setEntries(data);
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadSchedule(); }, [filterMode, filterId]); // eslint-disable-line

  const generate = async () => {
    setGenerating(true); setMessage(null);
    try {
      const res = await api.generate() as { entries_count: number; conflicts: string[] };
      if (res.conflicts.length > 0) {
        setMessage({ type: "error", text: res.conflicts.join(" | ") });
      } else {
        setMessage({ type: "success", text: `Plan wygenerowany pomyślnie — ${res.entries_count} wpisów.` });
      }
      loadSchedule();
    } catch (e: unknown) {
      setMessage({ type: "error", text: String(e) });
    } finally {
      setGenerating(false);
    }
  };

  const clearAuto = async () => {
    if (!confirm("Usunąć wszystkie automatycznie wygenerowane wpisy?")) return;
    await api.clear();
    loadSchedule();
  };

  const filterList = filterMode === "group" ? groups : filterMode === "lecturer" ? lecturers : rooms;
  const filterLabel = (item: StudentGroup | Lecturer | Room) => {
    if ("email" in item) return `${(item as Lecturer).title} ${(item as Lecturer).name}`;
    if ("capacity" in item) return (item as Room).name;
    return (item as StudentGroup).name;
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginRight: "auto" }}>Plan zajęć</h1>
        <button className="btn-success" onClick={generate} disabled={generating} style={{ minWidth: "160px" }}>
          {generating ? "Generowanie…" : "Generuj plan"}
        </button>
        <button className="btn-ghost" onClick={clearAuto}>Wyczyść auto</button>
      </div>

      {message && (
        <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`}>
          {message.text}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center", padding: "1rem 1.25rem" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Widok dla:</span>
        {(["group", "lecturer", "room"] as FilterMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setFilterMode(m); setFilterId(""); }}
            style={{
              padding: "0.3rem 0.85rem", borderRadius: "6px", border: "1px solid",
              borderColor: filterMode === m ? "#2563eb" : "#d1d5db",
              background: filterMode === m ? "#dbeafe" : "#f9fafb",
              color: filterMode === m ? "#1e40af" : "#374151",
              fontSize: "0.8rem", cursor: "pointer",
            }}
          >
            {{ group: "Grupy", lecturer: "Wykładowcy", room: "Sale" }[m]}
          </button>
        ))}
        <select
          value={filterId}
          onChange={(e) => setFilterId(e.target.value ? Number(e.target.value) : "")}
          style={{ maxWidth: "220px" }}
        >
          <option value="">— wszystkie —</option>
          {filterList.map((item) => (
            <option key={(item as { id: number }).id} value={(item as { id: number }).id}>
              {filterLabel(item)}
            </option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", fontSize: "0.78rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 14, height: 14, background: "#2563eb", borderRadius: 3, display: "inline-block" }} />
          Automatyczny
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 14, height: 14, background: "#7c3aed", borderRadius: 3, display: "inline-block" }} />
          Ręczny
        </span>
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate="2025-01-06"
          validRange={{ start: "2025-01-06", end: "2025-01-11" }}
          headerToolbar={false}
          dayHeaderContent={(arg) => {
            const d = arg.date.getDay();
            const idx = d === 0 ? 6 : d - 1;
            return DAYS_PL[idx] ?? arg.text;
          }}
          hiddenDays={[0, 6]}
          slotMinTime="07:50:00"
          slotMaxTime="17:10:00"
          slotDuration="00:10:00"
          slotLabelInterval="00:30:00"
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          height="auto"
          events={entries.map(entryToEvent)}
          eventContent={(arg) => (
            <div style={{ fontSize: "0.72rem", lineHeight: 1.3, padding: "2px 4px", overflow: "hidden" }}>
              {arg.event.title.split("\n").map((line, i) => (
                <div key={i} style={{ fontWeight: i === 0 ? 700 : 400 }}>{line}</div>
              ))}
            </div>
          )}
        />
      </div>

      {entries.length === 0 && (
        <p style={{ textAlign: "center", color: "#9ca3af", marginTop: "1rem", fontSize: "0.875rem" }}>
          Plan jest pusty. Dodaj przypisania, a następnie kliknij „Generuj plan".
        </p>
      )}
    </div>
  );
}
