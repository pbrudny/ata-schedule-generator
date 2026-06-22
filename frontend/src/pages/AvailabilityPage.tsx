import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { availability as api } from "../api";
import AvailabilityEditor from "../components/AvailabilityEditor";
import { AvailabilitySlot } from "../types";

interface LecturerAvailability {
  name: string;
  title: string;
  availability: AvailabilitySlot[];
  preferences: string;
}

type Status = "loading" | "ready" | "saving" | "saved" | "error" | "not_found";

export default function AvailabilityPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<LecturerAvailability | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [preferences, setPreferences] = useState("");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) return;
    api.get(token)
      .then((d) => {
        const ld = d as LecturerAvailability;
        setData(ld);
        setSlots(ld.availability ?? []);
        setPreferences(ld.preferences ?? "");
        setStatus("ready");
      })
      .catch((e) => {
        setStatus(e.message?.includes("404") ? "not_found" : "error");
      });
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setStatus("saving");
    try {
      await api.submit(token, { availability: slots, preferences });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2rem 1rem",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    padding: "2rem",
    width: "100%",
    maxWidth: "560px",
  };

  if (status === "loading") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ color: "#6b7280" }}>Ładowanie…</p>
        </div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ color: "#dc2626", fontWeight: 600 }}>Nieprawidłowy link.</p>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Sprawdź czy adres jest poprawny lub skontaktuj się z dziekanatem.
          </p>
        </div>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
          <h2 style={{ margin: "0 0 0.5rem", color: "#166534" }}>Dziękujemy!</h2>
          <p style={{ color: "#6b7280" }}>
            Twoja dostępność i preferencje zostały zapisane.
          </p>
          <button
            onClick={() => setStatus("ready")}
            style={{ marginTop: "1.25rem", padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}
          >
            Wróć do formularza
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Akademia Techniczno-Artystyczna
          </div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>
            Dzień dobry, {data?.title ? `${data.title} ` : ""}{data?.name}!
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
            Zaznacz bloki, w których <strong>możesz</strong> prowadzić zajęcia. Puste = brak ograniczeń.
          </p>
        </div>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151", margin: "0 0 0.75rem" }}>
            Dostępność
          </h2>
          <AvailabilityEditor value={slots} onChange={setSlots} />
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>
            Dodatkowe preferencje
          </label>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder='Np. "Zależy mi, by zajęcia były skoncentrowane w jednym dniu." lub "Proszę unikać piątków."'
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "0.6rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
              resize: "vertical",
              fontFamily: "inherit",
              color: "#111827",
            }}
          />
        </section>

        {status === "error" && (
          <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            Wystąpił błąd podczas zapisu. Spróbuj ponownie.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={status === "saving"}
          style={{
            width: "100%",
            padding: "0.65rem",
            background: status === "saving" ? "#93c5fd" : "#1e3a8a",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: status === "saving" ? "default" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {status === "saving" ? "Zapisywanie…" : "Zapisz dostępność"}
        </button>
      </div>
    </div>
  );
}
