import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import LecturersPage from "./pages/Lecturers";
import RoomsPage from "./pages/Rooms";
import GroupsPage from "./pages/Groups";
import CoursesPage from "./pages/Courses";
import AssignmentsPage from "./pages/Assignments";
import SchedulePage from "./pages/Schedule";
import AvailabilityPage from "./pages/AvailabilityPage";

const NAV = [
  { to: "/",            label: "Plan"          },
  { to: "/wykladowcy",  label: "Wykładowcy"    },
  { to: "/sale",        label: "Sale"          },
  { to: "/grupy",       label: "Grupy"         },
  { to: "/przedmioty",  label: "Przedmioty"    },
  { to: "/przypisania", label: "Przypisania"   },
];

function AdminLayout() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ background: "#1e3a8a", color: "#fff", padding: "0 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", height: "56px" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", whiteSpace: "nowrap" }}>
            ATA · Generator Planu
          </span>
          <nav style={{ display: "flex", gap: "0.25rem" }}>
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                style={({ isActive }) => ({
                  padding: "0.35rem 0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                  color: "#fff",
                  transition: "background 0.15s",
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, padding: "1.5rem", maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
        <Routes>
          <Route path="/"            element={<SchedulePage />} />
          <Route path="/wykladowcy"  element={<LecturersPage />} />
          <Route path="/sale"        element={<RoomsPage />} />
          <Route path="/grupy"       element={<GroupsPage />} />
          <Route path="/przedmioty"  element={<CoursesPage />} />
          <Route path="/przypisania" element={<AssignmentsPage />} />
        </Routes>
      </main>

      <footer style={{ textAlign: "center", padding: "0.75rem", fontSize: "0.75rem", color: "#9ca3af", borderTop: "1px solid #e5e7eb" }}>
        Akademia Techniczno-Artystyczna Nauk Stosowanych w Warszawie
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dostepnosc/:token" element={<AvailabilityPage />} />
        <Route path="/*" element={<AdminLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
