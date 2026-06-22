import { useEffect, useState } from "react";
import { rooms as api } from "../api";
import { Room, ROOM_FEATURES } from "../types";

const EMPTY: Omit<Room, "id"> = { name: "", capacity: 30, building: "", features: [] };

export default function RoomsPage() {
  const [list, setList]     = useState<Room[]>([]);
  const [modal, setModal]   = useState<Omit<Room, "id"> & { id?: number } | null>(null);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => (api.list() as Promise<Room[]>).then(setList);
  useEffect(() => { load(); }, []);

  const openNew  = () => setModal({ ...EMPTY });
  const openEdit = (r: Room) => setModal({ ...r });
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
    if (!confirm("Usunąć salę?")) return;
    await api.remove(id);
    load();
  };

  const toggleFeature = (f: string) => {
    if (!modal) return;
    const features = modal.features.includes(f)
      ? modal.features.filter((x) => x !== f)
      : [...modal.features, f];
    setModal({ ...modal, features });
  };

  const FEATURE_LABELS: Record<string, string> = {
    projektor: "Projektor",
    tablica: "Tablica",
    lab_komputerowe: "Lab komputerowe",
    klimatyzacja: "Klimatyzacja",
    nagłośnienie: "Nagłośnienie",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Sale</h1>
        <button className="btn-primary" onClick={openNew}>+ Dodaj</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Budynek</th>
              <th>Pojemność</th>
              <th>Wyposażenie</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td style={{ color: "#6b7280" }}>{r.building}</td>
                <td>{r.capacity} os.</td>
                <td>
                  {r.features.map((f) => (
                    <span key={f} className="badge" style={{ marginRight: "4px" }}>
                      {FEATURE_LABELS[f] ?? f}
                    </span>
                  ))}
                </td>
                <td style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => openEdit(r)}>Edytuj</button>
                  <button className="btn-danger" onClick={() => remove(r.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak sal</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal">
            <h2>{modal.id ? "Edytuj salę" : "Nowa sala"}</h2>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Nazwa *</label>
                <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="np. A101" />
              </div>
              <div className="form-group">
                <label>Budynek</label>
                <input value={modal.building} onChange={(e) => setModal({ ...modal, building: e.target.value })} placeholder="np. A" />
              </div>
            </div>

            <div className="form-group">
              <label>Pojemność (liczba miejsc) *</label>
              <input type="number" min={1} value={modal.capacity} onChange={(e) => setModal({ ...modal, capacity: Number(e.target.value) })} />
            </div>

            <div className="form-group">
              <label>Wyposażenie</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "4px" }}>
                {ROOM_FEATURES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFeature(f)}
                    style={{
                      padding: "0.3rem 0.75rem",
                      borderRadius: "999px",
                      border: "1px solid",
                      borderColor: modal.features.includes(f) ? "#2563eb" : "#d1d5db",
                      background: modal.features.includes(f) ? "#dbeafe" : "#f9fafb",
                      color: modal.features.includes(f) ? "#1e40af" : "#374151",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {FEATURE_LABELS[f] ?? f}
                  </button>
                ))}
              </div>
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
