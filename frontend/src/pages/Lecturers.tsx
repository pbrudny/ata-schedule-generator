import { useEffect, useState } from "react";
import { lecturers as api, courses as coursesApi } from "../api";
import { Course, Lecturer } from "../types";

type ModalState = {
  id?: number;
  public_token?: string | null;
  name: string;
  email: string;
  title: string;
  preferences: string;
  course_ids: number[];
};

const TITLES = ["", "mgr", "dr", "dr hab.", "prof."];

const EMPTY: ModalState = { name: "", email: "", title: "", preferences: "", course_ids: [] };

function copyLink(token: string | null | undefined) {
  if (!token) return;
  navigator.clipboard.writeText(`${window.location.origin}/dostepnosc/${token}`);
}

export default function LecturersPage() {
  const [list, setList]       = useState<Lecturer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modal, setModal]     = useState<ModalState | null>(null);
  const [copied, setCopied]   = useState<number | null>(null);
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);

  const load = () => (api.list() as Promise<Lecturer[]>).then(setList);
  useEffect(() => {
    load();
    (coursesApi.list() as Promise<Course[]>).then(setCourses);
  }, []);

  const openNew  = () => setModal({ ...EMPTY });
  const openEdit = (l: Lecturer) => setModal({
    id: l.id,
    public_token: l.public_token,
    name: l.name,
    email: l.email,
    title: l.title,
    preferences: l.preferences,
    course_ids: l.can_teach.map((c) => c.id),
  });
  const close = () => { setModal(null); setError(""); };

  const save = async () => {
    if (!modal) return;
    setSaving(true); setError("");
    try {
      if (modal.id) await api.update(modal.id, modal);
      else          await api.create(modal);
      close(); load();
    } catch (e: unknown) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Usunąć wykładowcę?")) return;
    await api.remove(id); load();
  };

  const toggleCourse = (id: number) => {
    if (!modal) return;
    const course_ids = modal.course_ids.includes(id)
      ? modal.course_ids.filter((x) => x !== id)
      : [...modal.course_ids, id];
    setModal({ ...modal, course_ids });
  };

  const handleCopy = (l: Lecturer) => {
    copyLink(l.public_token);
    setCopied(l.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Wykładowcy</h1>
        <button className="btn-primary" onClick={openNew}>+ Dodaj</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Imię i nazwisko</th>
              <th>Tytuł</th>
              <th>Email</th>
              <th>Może prowadzić</th>
              <th>Link dostępności</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 500 }}>{l.name}</td>
                <td>{l.title}</td>
                <td style={{ color: "#6b7280" }}>{l.email}</td>
                <td>
                  {l.can_teach.length === 0
                    ? <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>—</span>
                    : <span style={{ fontSize: "0.8rem", color: "#374151" }}>
                        {l.can_teach.map((c) => c.name).join(", ")}
                      </span>}
                </td>
                <td>
                  {l.public_token && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}
                      onClick={() => handleCopy(l)}
                    >
                      {copied === l.id ? "✓ Skopiowano" : "Kopiuj link"}
                    </button>
                  )}
                </td>
                <td style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => openEdit(l)}>Edytuj</button>
                  <button className="btn-danger" onClick={() => remove(l.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak wykładowców</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2>{modal.id ? "Edytuj wykładowcę" : "Nowy wykładowca"}</h2>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-row">
              <div className="form-group">
                <label>Tytuł</label>
                <select value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })}>
                  {TITLES.map((t) => <option key={t} value={t}>{t || "— brak —"}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 3 }}>
                <label>Imię i nazwisko *</label>
                <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Przedmioty, które może prowadzić</label>
              {courses.length === 0
                ? <p style={{ fontSize: "0.85rem", color: "#9ca3af", margin: "4px 0" }}>Najpierw dodaj przedmioty</p>
                : <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "6px", maxHeight: "200px", overflowY: "auto", padding: "4px 0" }}>
                    {courses.map((c) => (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                        <input
                          type="checkbox"
                          checked={modal.course_ids.includes(c.id)}
                          onChange={() => toggleCourse(c.id)}
                          style={{ width: "15px", height: "15px", cursor: "pointer" }}
                        />
                        <span style={{ color: "#374151" }}>{c.name}</span>
                        <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>{c.type}</span>
                      </label>
                    ))}
                  </div>
              }
            </div>

            {modal.id && modal.public_token && (
              <div className="form-group">
                <label>Link dla wykładowcy (dostępność)</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    readOnly
                    value={`${window.location.origin}/dostepnosc/${modal.public_token}`}
                    style={{ flex: 1, background: "#f9fafb", color: "#6b7280", fontSize: "0.8rem" }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button className="btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={() => copyLink(modal.public_token)}>
                    Kopiuj
                  </button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-ghost" onClick={close}>Anuluj</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
