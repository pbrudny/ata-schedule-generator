import { useRef, useState } from "react";

interface Issue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  items?: string[];
}

interface Props {
  onClose: () => void;
}

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  error:   { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", dot: "#ef4444" },
  warning: { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", dot: "#f59e0b" },
  info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1e40af", dot: "#3b82f6" },
};

const SEVERITY_LABEL: Record<string, string> = {
  error: "Błąd", warning: "Ostrzeżenie", info: "Informacja",
};

export default function ValidationPanel({ onClose }: Props) {
  const [phase, setPhase]       = useState<"idle" | "running" | "done">("idle");
  const [issues, setIssues]     = useState<Issue[]>([]);
  const [analysis, setAnalysis] = useState("");
  const [summary, setSummary]   = useState<{ errors: number; warnings: number } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setPhase("running"); setIssues([]); setAnalysis(""); setSummary(null); setExpanded(null);

    const response = await fetch("/api/schedule/validate/stream");
    if (!response.ok || !response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));

        if (data.type === "issues") {
          setIssues(data.issues);
          setSummary({ errors: data.errors, warnings: data.warnings });
        } else if (data.type === "analysis") {
          setAnalysis(prev => prev + data.text);
          if (analysisRef.current)
            analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
        } else if (data.type === "done") {
          setPhase("done");
        }
      }
    }
    setPhase("done");
  };

  const errors   = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  const infos    = issues.filter(i => i.severity === "info");
  const ordered  = [...errors, ...warnings, ...infos];

  return (
    <div className="card" style={{ marginBottom: "1rem", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1.25rem", borderBottom: issues.length ? "1px solid #e5e7eb" : "none" }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", flex: 1 }}>Agent walidacji danych</span>

        {summary && (
          <span style={{ fontSize: "0.78rem", display: "flex", gap: "0.5rem" }}>
            {summary.errors > 0 && (
              <span style={{ background: "#fee2e2", color: "#b91c1c", borderRadius: 9999, padding: "2px 8px", fontWeight: 600 }}>
                {summary.errors} błąd{summary.errors === 1 ? "" : summary.errors < 5 ? "y" : "ów"}
              </span>
            )}
            {summary.warnings > 0 && (
              <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 9999, padding: "2px 8px", fontWeight: 600 }}>
                {summary.warnings} ostrzeżeń{summary.warnings === 1 ? "ie" : ""}
              </span>
            )}
            {summary.errors === 0 && summary.warnings === 0 && (
              <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 9999, padding: "2px 8px", fontWeight: 600 }}>
                Dane poprawne
              </span>
            )}
          </span>
        )}

        {phase === "idle" && (
          <button className="btn-primary" onClick={run} style={{ fontSize: "0.82rem" }}>
            Sprawdź dane
          </button>
        )}
        {phase === "running" && (
          <span style={{ fontSize: "0.82rem", color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: "blink 1s ease-in-out infinite" }} />
            Analizuję…
          </span>
        )}
        {phase === "done" && (
          <button className="btn-ghost" onClick={run} style={{ fontSize: "0.82rem" }}>
            Sprawdź ponownie
          </button>
        )}

        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1rem", lineHeight: 1, padding: "0 4px" }}>✕</button>
      </div>

      {/* Issues list */}
      {ordered.length > 0 && (
        <div style={{ padding: "0.75rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {ordered.map((issue, idx) => {
            const s = SEVERITY_STYLE[issue.severity];
            const isOpen = expanded === idx;
            return (
              <div key={idx} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8 }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : idx)}
                  style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: "0.6rem", padding: "0.6rem 0.875rem", background: "none", border: "none", cursor: issue.items?.length ? "pointer" : "default", textAlign: "left" }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 6 }}>
                      {SEVERITY_LABEL[issue.severity]} · {issue.category}
                    </span>
                    <div style={{ fontSize: "0.83rem", color: "#374151", marginTop: 2, lineHeight: 1.4 }}>
                      {issue.message}
                    </div>
                  </div>
                  {issue.items?.length ? (
                    <span style={{ color: s.dot, fontSize: "0.75rem", flexShrink: 0, marginTop: 4 }}>{isOpen ? "▲" : `▼ ${issue.items.length}`}</span>
                  ) : null}
                </button>

                {isOpen && issue.items && (
                  <ul style={{ margin: "0 0 0.6rem 2.5rem", paddingLeft: 0, listStyle: "none", fontSize: "0.8rem", color: "#374151" }}>
                    {issue.items.map((item, i) => (
                      <li key={i} style={{ padding: "1px 0" }}>— {item}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LLM analysis */}
      {(analysis || phase === "running") && (
        <div style={{ borderTop: "1px solid #e5e7eb", padding: "0.875rem 1.25rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#60a5fa", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Ocena agenta AI
          </div>
          <div
            ref={analysisRef}
            style={{
              background: "#0f172a", borderRadius: 8, padding: "0.75rem 1rem",
              fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.65,
              whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            {analysis}
            {phase === "running" && (
              <span style={{ display: "inline-block", width: 8, height: "1em", background: "#60a5fa", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
            )}
          </div>
        </div>
      )}

      {phase === "done" && issues.length === 0 && (
        <div style={{ padding: "1rem 1.25rem", color: "#15803d", fontSize: "0.875rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span>✓</span> Dane wyglądają poprawnie — można generować plan.
        </div>
      )}
    </div>
  );
}
