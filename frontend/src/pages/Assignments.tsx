import { useEffect, useState } from "react";
import { assignments as api, courses, groups, lecturers } from "../api";
import { Course, CourseAssignment, Lecturer, StudentGroup } from "../types";

const EMPTY = { course_id: 0, lecturer_id: 0, group_id: 0, sessions_per_week: 1, blocks_per_session: 2 };

export default function AssignmentsPage() {
  const [list, setList]             = useState<CourseAssignment[]>([]);
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [lectList, setLectList]     = useState<Lecturer[]>([]);
  const [groupList, setGroupList]   = useState<StudentGroup[]>([]);
  const [modal, setModal]           = useState<typeof EMPTY & { id?: number } | null>(null);
  const [error, setError]           = useState("");
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    const [a, c, l, g] = await Promise.all([
      api.list() as Promise<CourseAssignment[]>,
      courses.list() as Promise<Course[]>,
      lecturers.list() as Promise<Lecturer[]>,
      groups.list() as Promise<StudentGroup[]>,
    ]);
    setList(a); setCourseList(c); setLectList(l); setGroupList(g);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!modal) return;
    if (!modal.course_id || !modal.lecturer_id || !modal.group_id) {
      setError("Wybierz przedmiot, wykładowcę i grupę."); return;
    }
    setSaving(true); setError("");
    try {
      if (modal.id) await api.update(modal.id, modal);
      else          await api.create(modal);
      setModal(null); load();
    } catch (e: unknown) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Usunąć przypisanie?")) return;
    await api.remove(id); load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Przypisania zajęć</h1>
        <button className="btn-primary" onClick={() => setModal({ ...EMPTY })}>+ Dodaj</button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1rem" }}>
        Przypisanie określa: kto (wykładowca) prowadzi co (przedmiot) dla kogo (grupy) i ile razy w tygodniu.
      </p>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Przedmiot</th><th>Wykładowca</th><th>Grupa</th><th>Sesji/tydzień</th><th>Bloków/sesję</th><th /></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.course.name} <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>({a.course.type})</span></td>
                <td>{a.lecturer.title} {a.lecturer.name}</td>
                <td>{a.group.name}</td>
                <td style={{ textAlign: "center" }}>{a.sessions_per_week}×</td>
                <td style={{ textAlign: "center" }}>{a.blocks_per_session} blok(i)</td>
                <td style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => setModal({ ...a })}>Edytuj</button>
                  <button className="btn-danger" onClick={() => remove(a.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak przypisań</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h2>{modal.id ? "Edytuj przypisanie" : "Nowe przypisanie"}</h2>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Przedmiot *</label>
              <select value={modal.course_id} onChange={(e) => setModal({ ...modal, course_id: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {courseList.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Wykładowca *</label>
              <select value={modal.lecturer_id} onChange={(e) => setModal({ ...modal, lecturer_id: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {lectList.map((l) => <option key={l.id} value={l.id}>{l.title} {l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Grupa *</label>
              <select value={modal.group_id} onChange={(e) => setModal({ ...modal, group_id: Number(e.target.value) })}>
                <option value={0}>— wybierz —</option>
                {groupList.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.size} os.)</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Sesji w tygodniu</label>
                <input type="number" min={1} max={5} value={modal.sessions_per_week} onChange={(e) => setModal({ ...modal, sessions_per_week: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Bloków na sesję</label>
                <input type="number" min={1} max={5} value={modal.blocks_per_session} onChange={(e) => setModal({ ...modal, blocks_per_session: Number(e.target.value) })} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModal(null)}>Anuluj</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Zapisywanie…" : "Zapisz"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
