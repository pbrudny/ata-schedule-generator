import { useEffect, useRef, useState } from "react";
import { generationHistory as api } from "../api";
import { GenerationAttempt } from "../types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 9999,
      fontSize: "0.75rem", fontWeight: 600,
      background: ok ? "#dcfce7" : "#fee2e2",
      color: ok ? "#15803d" : "#b91c1c",
    }}>
      {ok ? "Sukces" : "Niepowodzenie"}
    </span>
  );
}

export default function GenerationHistoryPage() {
  const [list, setList] = useState<GenerationAttempt[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState<{ id: number; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const thinkingRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const data = await api.list() as GenerationAttempt[];
    setList(data);
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: number) => setExpanded(prev => prev === id ? null : id);

  const saveNotes = async () => {
    if (!editNotes) return;
    setSaving(true);
    try {
      await api.updateNotes(editNotes.id, editNotes.text);
      setList(prev => prev.map(a => a.id === editNotes.id ? { ...a, notes: editNotes.text } : a));
      setEditNotes(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Historia generowania planu</h1>
      <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "1.25rem" }}>
        Każda próba generowania jest zapisywana z analizą AI, problemami i sugestiami rozwiązań.
      </p>

      {list.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem", color: "#9ca3af" }}>
          Brak historii. Wygeneruj plan, aby zobaczyć pierwsze wpisy.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {list.map((attempt) => {
          const isOpen = expanded === attempt.id;
          return (
            <div key={attempt.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header row */}
              <button
                onClick={() => toggle(attempt.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "1rem",
                  padding: "0.875rem 1.25rem", background: "none", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "#6b7280", minWidth: 130 }}>
                  {formatDate(attempt.created_at)}
                </span>
                <Badge ok={attempt.success} />
                <span style={{ fontSize: "0.85rem", color: "#374151" }}>
                  {attempt.entries_count} wpisów
                  {attempt.online_count > 0 && (
                    <span style={{ color: "#059669", marginLeft: 6 }}>({attempt.online_count} online)</span>
                  )}
                </span>
                <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                  {attempt.assignments_count} przypisań · {attempt.lecturers_count} wykł. · {attempt.rooms_count} sal · {attempt.groups_count} grup
                </span>
                {attempt.conflicts.length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#b91c1c", background: "#fee2e2", borderRadius: 6, padding: "2px 8px" }}>
                    {attempt.conflicts.length} konflikt{attempt.conflicts.length === 1 ? "" : "ów"}
                  </span>
                )}
                <span style={{ marginLeft: attempt.conflicts.length ? "0.5rem" : "auto", color: "#9ca3af", fontSize: "0.8rem" }}>
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: "1px solid #e5e7eb", padding: "1.25rem" }}>

                  {/* LLM thinking */}
                  {attempt.thinking && (
                    <section style={{ marginBottom: "1.25rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#60a5fa", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Analiza AI — proces myślenia przed generowaniem
                      </div>
                      <div
                        ref={thinkingRef}
                        style={{
                          background: "#0f172a", borderRadius: 8, padding: "0.875rem 1rem",
                          fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.65,
                          whiteSpace: "pre-wrap", maxHeight: 240, overflowY: "auto",
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        }}
                      >
                        {attempt.thinking}
                      </div>
                    </section>
                  )}

                  {/* Conflicts */}
                  {attempt.conflicts.length > 0 && (
                    <section style={{ marginBottom: "1.25rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#b91c1c", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Problemy / konflikty
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#374151", lineHeight: 1.7 }}>
                        {attempt.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </section>
                  )}

                  {/* Suggestions */}
                  {attempt.suggestions && (
                    <section style={{ marginBottom: "1.25rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Sugestie rozwiązań
                      </div>
                      <div style={{
                        background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8,
                        padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#78350f",
                        whiteSpace: "pre-wrap", lineHeight: 1.6,
                      }}>
                        {attempt.suggestions}
                      </div>
                    </section>
                  )}

                  {/* Notes */}
                  <section>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Uwagi / strategia
                    </div>
                    {editNotes?.id === attempt.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <textarea
                          value={editNotes.text}
                          onChange={e => setEditNotes({ ...editNotes, text: e.target.value })}
                          rows={3}
                          placeholder="Opisz strategię lub wnioski z tej próby…"
                          style={{ width: "100%", resize: "vertical", fontSize: "0.875rem", padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "inherit" }}
                        />
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="btn-primary" onClick={saveNotes} disabled={saving} style={{ fontSize: "0.8rem" }}>
                            {saving ? "Zapisywanie…" : "Zapisz"}
                          </button>
                          <button className="btn-ghost" onClick={() => setEditNotes(null)} style={{ fontSize: "0.8rem" }}>Anuluj</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setEditNotes({ id: attempt.id, text: attempt.notes })}
                        style={{
                          minHeight: 48, padding: "0.5rem 0.75rem", borderRadius: 6,
                          border: "1px dashed #d1d5db", cursor: "text", fontSize: "0.875rem",
                          color: attempt.notes ? "#374151" : "#9ca3af", lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {attempt.notes || "Kliknij, aby dodać uwagi…"}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
