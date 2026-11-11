# EvalHub REST API — contract v0.1 (Sprint 1)

Base URL (dev): `http://localhost:3000/api` · JSON in/out · **camelCase** fields · dates `YYYY-MM-DD`.

## Conventions

- **Auth:** `Authorization: Bearer <jwt>` on everything except `POST /auth/login` and `GET /health`.
  JWT claims: `sub` (user id), `role` (`faculty` | `ac_member` | `admin`), `tid` (linked teacher id or null). Default expiry 8 h.
- **Errors:** always `{ "error": { "code": "...", "message": "...", "details": [...]? } }`
  `400 validation_error` · `401 unauthorized` / `invalid_credentials` · `403 forbidden` · `404 not_found` · `409 conflict` / `foreign_key_violation` · `429 rate_limited` · `500 internal_error`
- **Pagination:** `?page=1&pageSize=25` (max 100) → `{ "data": [...], "page": 1, "pageSize": 25, "total": 100 }`
- **"AC/admin"** = role `ac_member` or `admin`.

## Auth

| Route | Who | Notes |
|---|---|---|
| `POST /auth/login` | public | `{ email, password }` → `{ token, user }`. 20 attempts / 15 min / IP |
| `GET /auth/me` | any | current user + linked teacher name |
| `POST /auth/register` | admin | `{ email, password (≥12 chars), role, teacherId? }`; `teacherId` required unless role is `admin` |

## Teachers

| Route | Who | Notes |
|---|---|---|
| `GET /teachers` | AC/admin | filters `q`, `school` (code, e.g. ECS), `rank`, `active=true\|false` + pagination |
| `GET /teachers/:id` | AC/admin or self | |
| `POST /teachers` | AC/admin | |
| `PATCH /teachers/:id` | AC/admin | partial update |
| `DELETE /teachers/:id` | AC/admin | **soft delete** (`isActive=false`), returns 204 |

```jsonc
{ "id": 3, "firstName": "Professor", "lastName": "C", "email": "professor.c@example.edu",
  "school": "ECS", "rank": "assistant_professor",  // rank: assistant_professor | associate_professor | full_professor
  "isActive": true, "createdAt": "2026-09-18T12:00:00.000Z", "updatedAt": "2026-09-18T12:00:00.000Z" }
```

## Terms

| Route | Who | Notes |
|---|---|---|
| `GET /terms` | any | newest first, not paginated |
| `POST /terms` | AC/admin | `{ season, year, startDate, endDate }` |

```jsonc
{ "id": 10, "season": "fall", "year": 2026, "startDate": "2026-08-17", "endDate": "2026-12-11", "isLongTerm": true }
```

## Courses & sections

| Route | Who | Notes |
|---|---|---|
| `GET /courses` | any | filters `q`, `subject`, `school`, `level` (1–9) + pagination |
| `GET /courses/:id` | any | |
| `POST /courses` | AC/admin | `{ subject, school, courseNumber, title, externalId? }` — `courseLevel` is derived |
| `PATCH /courses/:id` | AC/admin | |
| `DELETE /courses/:id` | AC/admin | 409 while sections exist |
| `GET /courses/:id/sections` | any | filters `termId`, `teacherId` |
| `POST /courses/:id/sections` | AC/admin | `{ termId, sectionNumber, teacherId?, meetingDays?, startTime?, endTime?, location? }` |
| `GET /sections` | any | filters `teacherId`, `termId`, `level` |
| `PATCH /sections/:id` | AC/admin | |
| `DELETE /sections/:id` | AC/admin | |

```jsonc
// Course
{ "id": 6, "subject": "CS", "school": "ECS", "courseNumber": "4485", "title": "Computer Science Project",
  "courseLevel": 4, "source": "manual", "externalId": null }
// Section
{ "id": 22, "courseId": 6, "termId": 10, "sectionNumber": "001", "teacherId": 6,
  "meetingDays": "F", "startTime": "13:00", "endTime": "15:45", "location": null,
  "source": "manual", "externalId": null }
```

## Assessments (sign-up) — Sprint 2

| Route | Who | Notes |
|---|---|---|
| `GET /assessments` | AC/admin | filters `teacherId`, `termId`, `status` + pagination |
| `GET /assessments/mine` | faculty | the current user's own sign-ups |
| `GET /assessments/:id` | AC/admin, or the owning teacher | |
| `POST /assessments/sign-up` | faculty (self) or AC/admin (on behalf of a teacher) | `{ sectionId, teacherId? }`. The teacher must be the instructor of the section. One assessment per section — a duplicate sign-up returns `409 conflict`. |
| `POST /assessments/:id/cancel` | AC/admin | `{ reason?: "not_eligible"\|"left_department"\|"other", notes? }` |

```jsonc
// Assessment
{ "id": 1, "teacherId": 3, "sectionId": 21, "dueTermId": 10, "status": "signed_up",
  // status: signed_up | candidates_generated | pending_ac_approval | approved | completed | not_eligible | postponed | cancelled
  "signedUpAt": "2026-09-29T12:00:00.000Z", "completedAt": null, "notes": null,
  "createdAt": "2026-09-29T12:00:00.000Z", "updatedAt": "2026-09-29T12:00:00.000Z" }
```

## Assessment workflow (🗓 not yet built)

| | Route | Who | Purpose |
|---|---|---|---|
| 🗓 | `POST /assessments/:id/candidates` | owner / AC | surface ~5 eligible observers; see `db/queries/eligible_observers.sql` |
| 🗓 | `POST /assessments/:id/observations` `{ observerId, candidateListId? }` | owner / AC | record the chosen observer → `proposed` (AC step-in sets `isAcStepin`, omits `candidateListId`) |
| 🗓 | `POST /observations/:id/review` `{ decision: "approved"\|"rejected", notes? }` | AC | human-in-the-loop gate |
| 🗓 | `POST /observations/:id/sign-off` | observer or observee | both required before `completed` |
| 🗓 | `POST /observations/:id/feedback` `{ rating, comments? }` | participants | process feedback |
| 🗓 | `GET/POST/PATCH /criteria` | AC | evaluation criteria, weights, scoring |

## Auth boundary with Integration

Backend ships login + `authenticate` / `requireRole` (Sprint 1 "basic JWT auth"). Integration owns further role checks. Shared shape: `req.user = { id, role, teacherId }`.
