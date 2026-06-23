import { useEffect, useState } from "react";
import { assignments as api, courses, groups, lecturers } from "../api";
import { Course, CourseAssignment, Lecturer, StudentGroup } from "../types";

type ModalState = {
  id?: number;
  course_id: number;
  lecturer_id: number;
  group_ids: number[];
  sessions_per_week: number;
};

const EMPTY: ModalState = { course_id: 0, lecturer_id: 0, group_ids: [], sessions_per_week: 1 };

export default function AssignmentsPage() {
  const [list, setList]             = useState<CourseAssignment[]>([]);
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [lectList, setLectList]     = useState<Lecturer[]>([]);
  const [groupList, setGroupList]   = useState<StudentGroup[]>([]);
  const [modal, setModal]           = useState<ModalState | null>(null);
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

  const openEdit = (a: CourseAssignment) => {
    setModal({ id: a.id, course_id: a.course_id, lecturer_id: a.lecturer_id, group_ids: a.groups.map(g => g.id), sessions_per_week: a.sessions_per_week });
  };

  const toggleGroup = (id: number) => {
    if (!modal) return;
    setModal({
      ...modal,
      group_ids: modal.group_ids.includes(id)
        ? modal.group_ids.filter(x => x !== id)
        : [...modal.group_ids, id],
    });
  };

  const save = async () => {
    if (!modal) return;
    if (!modal.course_id || !modal.lecturer_id || modal.group_ids.length === 0) {
      setError("Wybierz przedmiot, wykładowcę i co najmniej jedną grupę."); return;
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
        <button className="btn-primary" onClick={() => { setError(""); setModal({ ...EMPTY }); }}>+ Dodaj</button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1rem" }}>
        Przypisanie określa: kto (wykładowca) prowadzi co (przedmiot) dla których grup i ile razy w tygodniu.
      </p>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Przedmiot</th><th>Wykładowca</th><th>Grupy</th><th>Sesji/tydzień</th><th /></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.course.name} <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>({a.course.type})</span></td>
                <td>{a.lecturer.title} {a.lecturer.name}</td>
                <td style={{ fontSize: "0.82rem" }}>
                  {a.groups.length === 0
                    ? <span style={{ color: "#9ca3af" }}>—</span>
                    : a.groups.map(g => (
                        <span key={g.id} style={{ display: "inline-block", background: "#eff6ff", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px", marginRight: 3, marginBottom: 2, fontSize: "0.78rem" }}>{g.name}</span>
                      ))
                  }
                </td>
                <td style={{ textAlign: "center" }}>{a.sessions_per_week}×</td>
                <td style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => openEdit(a)}>Edytuj</button>
                  <button className="btn-danger" onClick={() => remove(a.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak przypisań</td></tr>
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
              <label>Grupy * <span style={{ fontWeight: 400, color: "#6b7280", fontSize: "0.8rem" }}>({modal.group_ids.length} zaznaczonych)</span></label>
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 0.75rem" }}>
                {groupList.map((g) => (
                  <label key={g.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "3px 0", cursor: "pointer", fontSize: "0.875rem" }}>
                    <input
                      type="checkbox"
                      checked={modal.group_ids.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                    />
                    <span>{g.name}</span>
                    <span style={{ color: "#9ca3af", fontSize: "0.78rem" }}>({g.size} os., sem. {g.semester})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Sesji w tygodniu</label>
              <input type="number" min={1} max={5} value={modal.sessions_per_week} onChange={(e) => setModal({ ...modal, sessions_per_week: Number(e.target.value) })} />
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
