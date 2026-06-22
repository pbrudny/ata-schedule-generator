# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Full-stack MVP implemented. Backend (FastAPI + OR-Tools), frontend (React + FullCalendar), Docker Compose ready for Coolify. See `prd.md` for full requirements (written in Polish).

## What This Project Is

An automated class schedule generator for a university registrar's office (dziekanat). The system manages lecturers, rooms, student groups, and courses, then uses constraint-solving to generate conflict-free timetables.

## Local Development

```bash
# Start everything (requires Docker)
docker compose up --build

# Backend only (needs a local Postgres)
cd backend && pip install -r requirements.txt
DATABASE_URL=postgresql://ata:changeme@localhost:5432/ata_schedule uvicorn app.main:app --reload

# Frontend only (proxies /api to localhost:8000 via Vite)
cd frontend && npm install --registry https://registry.npmjs.org
npm run dev   # http://localhost:5173

# TypeScript check
cd frontend && ./node_modules/.bin/tsc --noEmit
```

## UI Language

**All user-facing text must be in Polish.** This includes labels, buttons, error messages, form placeholders, and calendar views.

## Planned Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy + PostgreSQL |
| Scheduler | Python + Google OR-Tools |
| Frontend | React + FullCalendar |

## Planned Backend Structure

```
backend/app/
  main.py
  database.py
  models/       # SQLAlchemy ORM models
  schemas/      # Pydantic schemas
  routers/      # FastAPI route handlers
  services/
    scheduler.py  # OR-Tools constraint solver
```

## Core Data Models

- **Lecturer** — id, name, email, availability
- **Room** — id, name, capacity, features
- **StudentGroup** — id, name, size
- **Course** — id, name, hours, type, priority, requirements
- **ScheduleEntry** — course_id, lecturer_id, room_id, group_id, day, start_time, end_time

## Scheduler Constraints

**Hard (must hold):** lecturer/room/group can't have two classes at the same time; classes only within lecturer availability; room must meet course requirements.

**Soft (optimised):** lecturer preferences, minimising gaps, class priorities.

## Implementation Order (from PRD)

1. FastAPI + PostgreSQL + models + CRUD
2. Calendar view + schedule API
3. OR-Tools scheduler
4. Google Calendar integration

## Key API Endpoints

```
GET/POST /lecturers
GET/POST /rooms
GET      /schedule
POST     /schedule/generate
```

---

## Deployment

**Target:** Coolify at `https://dashboard.codewithpeter.com`

**Credentials:** `COOLIFY_TOKEN` is in `~/agenty/secrets/.env`. Load it from there — never hardcode or print it.

### Build pack

Always use **`dockerfile`** build pack. Do not use:
- `nixpacks` — fails with RuntimeException after npm install (known issue on this server)
- `static` — only copies source files, does not run `npm build`

The app must include a `Dockerfile` (or `docker-compose.yml` for multi-service).

### Domain & TLS

- Use a subdomain on `codewithpeter.com` (e.g. `ata-schedule.codewithpeter.com`).
- TLS is handled by Cloudflare — no Let's Encrypt configuration needed for `*.codewithpeter.com`.
- All traffic flows: Cloudflare → Cloudflare Tunnel → `http://localhost:80` → Traefik → container.

### Coolify deploy flow

```
1. GET  /api/v1/servers                       → get server_uuid
2. GET  /api/v1/projects                      → get or create project_uuid
3. POST /api/v1/applications/public           → create app, get app_uuid
   { build_pack: "dockerfile", domains: "ata-schedule.codewithpeter.com", ... }
4. POST /api/v1/applications/{uuid}/envs      → set DATABASE_URL and other env vars
5. GET  /api/v1/deploy?uuid={app_uuid}        → trigger deployment
6. GET  /api/v1/deployments/applications/{uuid} → poll until status = "finished"
```

### Database

A PostgreSQL connection string is available as `CODING_ASSISTANT_DATABASE_URL` in `~/agenty/secrets/.env`. Evaluate whether to reuse it or provision a dedicated database for this project.

### Docker Compose (recommended for multi-service)

Use `docker-compose.yml` at the repo root with `build_pack: "dockercompose"`. Services: `backend` (FastAPI, port 8000), `frontend` (React/nginx, port 80). Traefik routing is handled by Coolify via the `domains` field — do not configure Traefik labels manually.
