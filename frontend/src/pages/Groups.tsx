import { useEffect, useState } from "react";
import { groups as api } from "../api";
import { StudentGroup, STUDY_MODES } from "../types";

const EMPTY: Omit<StudentGroup, "id"> = { name: "", size: 20, year: 1, study_mode: "stacjonarne" };

export default function GroupsPage() {
  const [list, setList]     = useState<StudentGroup[]>([]);
  const [modal, setModal]   = useState<Omit<StudentGroup, "id"> & { id?: number } | null>(null);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => (api.list() as Promise<StudentGroup[]>).then(setList);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!modal) return;
    setSaving(true); setError("");
    try {
      if (modal.id) await api.update(modal.id, modal);
      else          await api.create(modal);
      setModal(null); load();
    } catch (e: unknown) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Usunąć grupę?")) return;
    await api.remove(id); load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Grupy studentów</h1>
        <button className="btn-primary" onClick={() => setModal({ ...EMPTY })}>+ Dodaj</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Nazwa</th><th>Rok</th><th>Tryb</th><th>Liczba studentów</th><th /></tr></thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.id}>
                <td style={{ fontWeight: 500 }}>{g.name}</td>
                <td>{g.year}</td>
                <td><span className="badge badge-green">{g.study_mode}</span></td>
                <td>{g.size} os.</td>
                <td style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => setModal({ ...g })}>Edytuj</button>
                  <button className="btn-danger" onClick={() => remove(g.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak grup</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h2>{modal.id ? "Edytuj grupę" : "Nowa grupa"}</h2>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Nazwa grupy *</label>
              <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="np. INF-1A" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Rok studiów</label>
                <select value={modal.year} onChange={(e) => setModal({ ...modal, year: Number(e.target.value) })}>
                  {[1,2,3,4,5].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tryb studiów</label>
                <select value={modal.study_mode} onChange={(e) => setModal({ ...modal, study_mode: e.target.value })}>
                  {STUDY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Liczba studentów *</label>
                <input type="number" min={1} value={modal.size} onChange={(e) => setModal({ ...modal, size: Number(e.target.value) })} />
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
