import { useEffect, useState } from "react";
import { courses as api } from "../api";
import { Course, COURSE_TYPES, ROOM_FEATURES } from "../types";

const EMPTY: Omit<Course, "id"> = { name: "", type: "wykład", priority: 1, required_features: [], min_room_capacity: 0 };

const FEATURE_LABELS: Record<string, string> = {
  projektor: "Projektor", tablica: "Tablica", lab_komputerowe: "Lab komputerowe",
  klimatyzacja: "Klimatyzacja", nagłośnienie: "Nagłośnienie",
};

const TYPE_BADGES: Record<string, string> = {
  wykład: "badge", ćwiczenia: "badge badge-green", laboratorium: "badge badge-yellow", seminarium: "badge badge-red",
};

export default function CoursesPage() {
  const [list, setList]     = useState<Course[]>([]);
  const [modal, setModal]   = useState<Omit<Course, "id"> & { id?: number } | null>(null);
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => (api.list() as Promise<Course[]>).then(setList);
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
    if (!confirm("Usunąć przedmiot?")) return;
    await api.remove(id); load();
  };

  const toggleFeature = (f: string) => {
    if (!modal) return;
    const required_features = modal.required_features.includes(f)
      ? modal.required_features.filter((x) => x !== f)
      : [...modal.required_features, f];
    setModal({ ...modal, required_features });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Przedmioty</h1>
        <button className="btn-primary" onClick={() => setModal({ ...EMPTY })}>+ Dodaj</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Nazwa</th><th>Typ</th><th>Priorytet</th><th>Wymagania</th><th /></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td><span className={TYPE_BADGES[c.type] ?? "badge"}>{c.type}</span></td>
                <td>{c.priority}</td>
                <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  {c.required_features.map((f) => FEATURE_LABELS[f] ?? f).join(", ") || "—"}
                  {c.min_room_capacity > 0 ? `, ≥${c.min_room_capacity} os.` : ""}
                </td>
                <td style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => setModal({ ...c })}>Edytuj</button>
                  <button className="btn-danger" onClick={() => remove(c.id)}>Usuń</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak przedmiotów</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h2>{modal.id ? "Edytuj przedmiot" : "Nowy przedmiot"}</h2>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Nazwa przedmiotu *</label>
              <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Typ zajęć</label>
                <select value={modal.type} onChange={(e) => setModal({ ...modal, type: e.target.value })}>
                  {COURSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Priorytet (1–5)</label>
                <input type="number" min={1} max={5} value={modal.priority} onChange={(e) => setModal({ ...modal, priority: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Min. pojemność sali</label>
                <input type="number" min={0} value={modal.min_room_capacity} onChange={(e) => setModal({ ...modal, min_room_capacity: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-group">
              <label>Wymagane wyposażenie sali</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "4px" }}>
                {ROOM_FEATURES.map((f) => (
                  <button key={f} type="button" onClick={() => toggleFeature(f)} style={{
                    padding: "0.3rem 0.75rem", borderRadius: "999px", border: "1px solid",
                    borderColor: modal.required_features.includes(f) ? "#2563eb" : "#d1d5db",
                    background: modal.required_features.includes(f) ? "#dbeafe" : "#f9fafb",
                    color: modal.required_features.includes(f) ? "#1e40af" : "#374151",
                    fontSize: "0.8rem", cursor: "pointer",
                  }}>{FEATURE_LABELS[f] ?? f}</button>
                ))}
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
