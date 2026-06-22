import { useEffect, useState } from "react";
import { lecturers as api } from "../api";
import AvailabilityEditor from "../components/AvailabilityEditor";
import { AvailabilitySlot, Lecturer } from "../types";

const EMPTY: Omit<Lecturer, "id"> = { name: "", email: "", title: "", availability: [] };

export default function LecturersPage() {
  const [list, setList]     = useState<Lecturer[]>([]);
  const [modal, setModal]   = useState<Omit<Lecturer, "id"> & { id?: number } | null>(null);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => (api.list() as Promise<Lecturer[]>).then(setList);
  useEffect(() => { load(); }, []);

  const openNew  = () => setModal({ ...EMPTY });
  const openEdit = (l: Lecturer) => setModal({ ...l });
  const close    = () => { setModal(null); setError(""); };

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    setError("");
    try {
      if (modal.id) await api.update(modal.id, modal);
      else          await api.create(modal);
      close();
      load();
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Usunąć wykładowcę?")) return;
    await api.remove(id);
    load();
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
              <th>Dostępność</th>
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
                  {l.availability.length === 0
                    ? <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>bez ograniczeń</span>
                    : <span className="badge">{l.availability.reduce((n, s) => n + s.blocks.length, 0)} bloków</span>}
                </td>
                <td style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => openEdit(l)}>Edytuj</button>
                  <button className="btn-danger" onClick={() => remove(l.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak wykładowców</td></tr>
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
                <input value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} placeholder="dr, prof., mgr..." />
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
              <label>Dostępność</label>
              <AvailabilityEditor
                value={modal.availability as AvailabilitySlot[]}
                onChange={(v) => setModal({ ...modal, availability: v })}
              />
            </div>

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
