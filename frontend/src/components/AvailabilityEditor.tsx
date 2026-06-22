import { AvailabilitySlot, BLOCK_TIMES, DAYS_SHORT } from "../types";

interface Props {
  value: AvailabilitySlot[];
  onChange: (v: AvailabilitySlot[]) => void;
}

export default function AvailabilityEditor({ value, onChange }: Props) {
  const isActive = (day: number, block: number) =>
    value.some((s) => s.day === day && s.blocks.includes(block));

  const toggle = (day: number, block: number) => {
    const existing = value.find((s) => s.day === day);
    if (existing) {
      const blocks = existing.blocks.includes(block)
        ? existing.blocks.filter((b) => b !== block)
        : [...existing.blocks, block].sort();
      const next = blocks.length === 0
        ? value.filter((s) => s.day !== day)
        : value.map((s) => (s.day === day ? { ...s, blocks } : s));
      onChange(next);
    } else {
      onChange([...value, { day, blocks: [block] }]);
    }
  };

  const BLOCKS = [1, 2, 3, 4, 5];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(5, 1fr)", gap: "4px", fontSize: "0.72rem" }}>
        <div />
        {BLOCKS.map((b) => (
          <div key={b} style={{ textAlign: "center", color: "#6b7280", fontWeight: 600, padding: "2px" }}>
            {BLOCK_TIMES[b].start}
          </div>
        ))}
        {DAYS_SHORT.map((day, d) => (
          <>
            <div key={`label-${d}`} style={{ fontWeight: 600, display: "flex", alignItems: "center", fontSize: "0.75rem" }}>
              {day}
            </div>
            {BLOCKS.map((b) => (
              <button
                key={`${d}-${b}`}
                type="button"
                onClick={() => toggle(d, b)}
                style={{
                  borderRadius: "5px",
                  border: "1px solid",
                  borderColor: isActive(d, b) ? "#2563eb" : "#d1d5db",
                  background: isActive(d, b) ? "#2563eb" : "#f9fafb",
                  cursor: "pointer",
                  height: "28px",
                  transition: "background 0.1s",
                }}
                title={`${day} blok ${b} (${BLOCK_TIMES[b].start}–${BLOCK_TIMES[b].end})`}
              />
            ))}
          </>
        ))}
      </div>
      <p style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "6px" }}>
        Kliknij komórkę aby zaznaczyć dostępność. Puste = brak ograniczeń.
      </p>
    </div>
  );
}
