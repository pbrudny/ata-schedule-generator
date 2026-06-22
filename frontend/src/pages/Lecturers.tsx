import { useEffect, useState } from "react";
import { lecturers as api } from "../api";
import AvailabilityEditor from "../components/AvailabilityEditor";
import { AvailabilitySlot, Lecturer } from "../types";

type ModalState = { id?: number; public_token?: string | null; name: string; email: string; title: string; availability: AvailabilitySlot[]; preferences: string };

const EMPTY: ModalState = {
  name: "", email: "", title: "", availability: [], preferences: "",
};

function copyLink(token: string | null | undefined) {
  if (!token) return;
  const url = `${window.location.origin}/dostepnosc/${token}`;
  navigator.clipboard.writeText(url);
}

export default function LecturersPage() {
  const [list, setList]     = useState<Lecturer[]>([]);
  const [modal, setModal]   = useState<ModalState | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
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
              <th>Dostępność</th>
              <th>Preferencje</th>
              <th>Link</th>
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
                <td style={{ maxWidth: "180px" }}>
                  {l.preferences
                    ? <span style={{ fontSize: "0.78rem", color: "#374151", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.preferences}</span>
                    : <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>—</span>}
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
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Brak wykładowców</td></tr>
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

            <div className="form-group">
              <label>Preferencje</label>
              <textarea
                value={modal.preferences ?? ""}
                onChange={(e) => setModal({ ...modal, preferences: e.target.value })}
                rows={3}
                placeholder="Preferencje podane przez wykładowcę..."
                style={{ width: "100%", boxSizing: "border-box", padding: "0.5rem 0.6rem", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.875rem", resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            {modal.id && modal.public_token && (
              <div className="form-group">
                <label>Link dla wykładowcy</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    readOnly
                    value={`${window.location.origin}/dostepnosc/${modal.public_token}`}
                    style={{ flex: 1, background: "#f9fafb", color: "#6b7280", fontSize: "0.8rem" }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button className="btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={() => copyLink(modal.public_token ?? null)}>
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
