import { useRef, useState } from "react";

interface Change {
  type: "mark_online" | "remove_assignment";
  label: string;
  reason?: string;
  course_id?: number;
  was?: boolean;
  data?: {
    course_id: number;
    lecturer_id: number;
    group_ids: number[];
    sessions_per_week: number;
    blocks_per_session: number;
  };
}

interface Step {
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  pending: boolean;
}

interface DonePayload {
  success: boolean;
  summary: string;
  changes: Change[];
  entries_count: number;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const TOOL_LABEL: Record<string, string> = {
  get_schedule_state:  "Sprawdzam stan danych",
  run_scheduler:       "Uruchamiam solver OR-Tools",
  mark_courses_online: "Oznaczam kursy jako online",
  remove_assignment:   "Usuwam przypisanie",
  finish:              "Podsumowanie agenta",
};

export default function AgentPanel({ onClose, onSuccess }: Props) {
  const [phase, setPhase]   = useState<"idle" | "running" | "done">("idle");
  const [steps, setSteps]   = useState<Step[]>([]);
  const [thinking, setThinking] = useState("");
  const [result, setResult] = useState<DonePayload | null>(null);
  const [reverting, setReverting] = useState(false);
  const [reverted, setReverted]   = useState(false);
  const thinkRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setPhase("running");
    setSteps([]);
    setThinking("");
    setResult(null);
    setReverted(false);

    const response = await fetch("/api/schedule/agent-solve/stream", { method: "POST" });
    if (!response.ok || !response.body) {
      setPhase("done");
      return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));

        if (data.type === "thinking") {
          setThinking((p) => p + data.text);
          if (thinkRef.current)
            thinkRef.current.scrollTop = thinkRef.current.scrollHeight;
        } else if (data.type === "step_start") {
          setSteps((p) => [...p, { tool: data.tool, args: data.args, pending: true }]);
        } else if (data.type === "step_done") {
          setSteps((p) => p.map((s, i) =>
            i === p.length - 1 && s.pending ? { ...s, result: data.result, pending: false } : s
          ));
        } else if (data.type === "done") {
          setResult(data as DonePayload);
          setPhase("done");
          if (data.success) onSuccess();
        }
      }
    }
    setPhase("done");
  };

  const revert = async () => {
    if (!result?.changes.length) return;
    setReverting(true);
    try {
      await fetch("/api/schedule/agent-solve/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: result.changes }),
      });
      setReverted(true);
      onSuccess(); // reload schedule (now empty)
    } finally {
      setReverting(false);
    }
  };

  const hasChanges = (result?.changes.length ?? 0) > 0;

  return (
    <div className="card" style={{ marginBottom: "1rem", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", flex: 1 }}>Agent rozwiązywania konfliktów</span>

        {phase === "idle" && (
          <button className="btn-primary" onClick={run} style={{ fontSize: "0.82rem" }}>
            Uruchom agenta
          </button>
        )}
        {phase === "running" && (
          <span style={{ fontSize: "0.82rem", color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: "blink 1s ease-in-out infinite" }} />
            Agent pracuje…
          </span>
        )}
        {phase === "done" && !reverted && (
          <button className="btn-ghost" onClick={run} style={{ fontSize: "0.82rem" }}>
            Uruchom ponownie
          </button>
        )}

        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1rem", lineHeight: 1, padding: "0 4px" }}>✕</button>
      </div>

      {/* Thinking panel */}
      {thinking && (
        <div style={{ borderBottom: "1px solid #e5e7eb", padding: "0.875rem 1.25rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#60a5fa", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Myślenie agenta
          </div>
          <div
            ref={thinkRef}
            style={{
              background: "#0f172a", borderRadius: 8, padding: "0.75rem 1rem",
              fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.65,
              whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            {thinking}
          </div>
        </div>
      )}

      {/* Steps list */}
      {steps.length > 0 && (
        <div style={{ padding: "0.75rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Kroki agenta
          </div>
          {steps.map((step, idx) => (
            <div key={idx} style={{
              display: "flex", gap: "0.75rem", alignItems: "flex-start",
              padding: "0.5rem 0.75rem", borderRadius: 8,
              background: step.pending ? "#eff6ff" : step.result?.startsWith("SUKCES") || step.result?.startsWith("Oznaczono") || step.result?.startsWith("Usunięto") ? "#f0fdf4" : "#f9fafb",
              border: `1px solid ${step.pending ? "#93c5fd" : "#e5e7eb"}`,
            }}>
              <span style={{ fontWeight: 700, color: "#6b7280", fontSize: "0.75rem", minWidth: "1.2rem", textAlign: "right", paddingTop: 2 }}>
                {idx + 1}.
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "#111827" }}>
                  {TOOL_LABEL[step.tool] ?? step.tool}
                  {step.args.assignment_id !== undefined && (
                    <span style={{ color: "#6b7280", fontWeight: 400 }}> — id={String(step.args.assignment_id)}</span>
                  )}
                  {Array.isArray(step.args.course_ids) && (
                    <span style={{ color: "#6b7280", fontWeight: 400 }}> — id: {(step.args.course_ids as number[]).join(", ")}</span>
                  )}
                </div>
                {step.args.reason != null && (
                  <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2, fontStyle: "italic" }}>
                    "{String(step.args.reason)}"
                  </div>
                )}
                {step.result && (
                  <div style={{ fontSize: "0.78rem", color: step.result.startsWith("NIEPOWODZENIE") ? "#dc2626" : "#059669", marginTop: 3, fontFamily: "ui-monospace, monospace" }}>
                    {step.result.length > 120 ? step.result.slice(0, 120) + "…" : step.result}
                  </div>
                )}
                {step.pending && (
                  <div style={{ fontSize: "0.78rem", color: "#3b82f6", marginTop: 3 }}>
                    Wykonuję…
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Final result */}
      {result && !reverted && (
        <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid #e5e7eb" }}>
          {/* Summary box */}
          <div style={{
            background: result.success ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${result.success ? "#86efac" : "#fca5a5"}`,
            borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "0.75rem",
          }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", color: result.success ? "#15803d" : "#991b1b", marginBottom: 4 }}>
              {result.success
                ? `Plan wygenerowany — ${result.entries_count} wpisów`
                : "Nie udało się wygenerować pełnego planu"}
            </div>
            <div style={{ fontSize: "0.83rem", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {result.summary}
            </div>
          </div>

          {/* Changes diff */}
          {hasChanges && (
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
                Zmiany wprowadzone przez agenta ({result.changes.length}):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {result.changes.map((c, i) => (
                  <div key={i} style={{
                    padding: "0.4rem 0.75rem", borderRadius: 6, fontSize: "0.8rem",
                    background: c.type === "mark_online" ? "#eff6ff" : "#fef2f2",
                    border: `1px solid ${c.type === "mark_online" ? "#93c5fd" : "#fca5a5"}`,
                    color: c.type === "mark_online" ? "#1e40af" : "#991b1b",
                  }}>
                    <span style={{ fontWeight: 600 }}>
                      {c.type === "mark_online" ? "Online: " : "Usunięto: "}
                    </span>
                    {c.label}
                    {c.reason && <span style={{ fontStyle: "italic", color: "#6b7280" }}> — {c.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {hasChanges && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }} />
              <button
                className="btn-ghost"
                onClick={revert}
                disabled={reverting}
                style={{ fontSize: "0.82rem", color: "#dc2626", borderColor: "#fca5a5" }}
              >
                {reverting ? "Cofanie…" : "Cofnij zmiany"}
              </button>
              <div style={{
                fontSize: "0.78rem", color: "#6b7280", display: "flex", alignItems: "center", padding: "0 0.25rem",
              }}>
                Zaakceptowane — zmiany są już aktywne.
              </div>
            </div>
          )}
        </div>
      )}

      {reverted && (
        <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.75rem 1rem", color: "#374151", fontSize: "0.875rem" }}>
            Zmiany agenta zostały cofnięte. Dane powróciły do stanu sprzed uruchomienia agenta.
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
