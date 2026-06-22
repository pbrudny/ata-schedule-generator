const BASE = "/api";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const get  = <T>(path: string)                  => req<T>("GET",    path);
const post = <T>(path: string, body: unknown)   => req<T>("POST",   path, body);
const put  = <T>(path: string, body: unknown)   => req<T>("PUT",    path, body);
const del  = <T>(path: string)                  => req<T>("DELETE", path);

// Lecturers
export const lecturers = {
  list:   ()           => get("/lecturers"),
  create: (b: unknown) => post("/lecturers", b),
  update: (id: number, b: unknown) => put(`/lecturers/${id}`, b),
  remove: (id: number) => del(`/lecturers/${id}`),
};

// Rooms
export const rooms = {
  list:   ()           => get("/rooms"),
  create: (b: unknown) => post("/rooms", b),
  update: (id: number, b: unknown) => put(`/rooms/${id}`, b),
  remove: (id: number) => del(`/rooms/${id}`),
};

// Groups
export const groups = {
  list:   ()           => get("/groups"),
  create: (b: unknown) => post("/groups", b),
  update: (id: number, b: unknown) => put(`/groups/${id}`, b),
  remove: (id: number) => del(`/groups/${id}`),
};

// Courses
export const courses = {
  list:   ()           => get("/courses"),
  create: (b: unknown) => post("/courses", b),
  update: (id: number, b: unknown) => put(`/courses/${id}`, b),
  remove: (id: number) => del(`/courses/${id}`),
};

// Assignments
export const assignments = {
  list:   ()           => get("/assignments"),
  create: (b: unknown) => post("/assignments", b),
  update: (id: number, b: unknown) => put(`/assignments/${id}`, b),
  remove: (id: number) => del(`/assignments/${id}`),
};

// Public availability (no auth — lecturer self-service)
export const availability = {
  get:    (token: string)                       => get(`/availability/${token}`),
  submit: (token: string, b: unknown)           => put(`/availability/${token}`, b),
};

// Schedule
export const schedule = {
  list:     (params?: Record<string, number>) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : "";
    return get(`/schedule${qs}`);
  },
  generate: ()           => post("/schedule/generate", {}),
  clear:    ()           => del("/schedule/clear"),
  update:   (id: number, b: unknown) => put(`/schedule/${id}`, b),
  remove:   (id: number) => del(`/schedule/${id}`),
};
