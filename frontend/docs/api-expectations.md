# API the frontend expects

The frontend runs on `src/lib/mockServer.js` until `VITE_API_URL` is set. The mock
is the executable version of this document: if a response shape here is unclear,
read the matching route in that file. Field names are camelCase, dates
`YYYY-MM-DD`, errors `{ "error": { "code", "message" } }` (same as
`backend/docs/api-contract.md`). `api.js` shows `error.message` to the user.

Nothing in `backend/` was changed. Status column: **exists** = already in the
backend and used as-is · **extend** = exists but the frontend needs more in the
response or body · **new** = not built yet.

## Endpoints

| Status | Route | Who | Frontend use |
|---|---|---|---|
| exists | `POST /auth/login`, `GET /auth/me` | any | sign-in, role + `teacherId` + name |
| exists | `GET /teachers`, `GET /teachers/:id` | AC/admin (`:id` also self) | professor roster, sign-up on behalf |
| exists | `GET /terms`, `GET /courses`, `GET /sections` | any | course/section pickers (frontend sends `pageSize=100`) |
| exists | `POST /assessments/sign-up` | faculty (self), AC/admin (on behalf) | sign-up form |
| extend | `GET /assessments`, `GET /assessments/mine` | AC/admin · faculty | return **AssessmentView** (below) instead of flat rows |
| extend | `GET /assessments/:id` | owner, AC/admin | return **AssessmentDetail** |
| extend | `POST /assessments/:id/candidates` | owner, AC/admin | return **AssessmentDetail**; see notes |
| extend | `POST /assessments/:id/observations` | **AC/admin only** | step-in / direct pairing; body adds required `scheduledDate` |
| extend | `POST /observations/:id/review` | AC/admin | see notes; returns `{ observation, assessment }` views |
| exists | `POST /assessments/:id/cancel` | AC/admin | committee "Cancel sign-up" |
| new | `GET /assessments/queue` | AC/admin | Approvals page + nav counter |
| new | `POST /assessments/:id/requests` `{ observerIds: number[] }` | owner | send requests to listed candidates; returns **AssessmentDetail** |
| new | `GET /assessments/:id/step-in-options` | AC/admin | committee members who can step in (`{ data: TeacherBrief[] }`) |
| new | `POST /assessments/:id/postpone` `{ notes? }` | AC/admin | postpone to next semester |
| new | `GET /observer-requests/incoming` | faculty / AC with a teacher profile | requests sent to me (`{ data: IncomingRequestView[] }`) |
| new | `POST /observer-requests/:id/accept` `{ scheduledDate }` | the observer | creates the pairing |
| new | `POST /observer-requests/:id/decline` | the observer | |
| new | `POST /observer-requests/:id/cancel` | owner, AC/admin | withdraw a pending request |
| new | `GET /observations` (`?status=`) | faculty → own given/received; AC/admin → all | `{ data: ObservationView[] }` |
| new | `GET /observations/:id` | observer, observee, AC/admin | confirmation page |
| new | `POST /observations/:id/sign-off` `{ comment? }` | observer or observee | `comment` is the observee's perspective |
| new | `POST /observations/:id/reschedule` `{ scheduledDate }` | observer, observee, AC/admin | approved observations only |
| new | `POST /observations/:id/not-completed` `{ reason }` | observer, observee, AC/admin | approved observations only |

## Shapes

```jsonc
// TeacherBrief
{ "id": 3, "firstName": "Professor", "lastName": "C", "email": "...", "rank": "assistant_professor", "school": "ECS" }

// SectionView = the flat section + nested course and term
{ "id": 21, "sectionNumber": "001", "meetingDays": "MW", "startTime": "13:00", "endTime": "14:15",
  "location": "ECSW 1.315",
  "course": { "id": 1, "subject": "CS", "courseNumber": "1337", "title": "...", "courseLevel": 1, "school": "ECS" },
  "term":   { "id": 10, "season": "fall", "year": 2026, "startDate": "2026-08-17", "endDate": "2026-12-11" } }

// AssessmentView (list rows) — existing assessment fields plus:
{ "teacher": TeacherBrief, "section": SectionView,
  "attention": null | "no_eligible_observers" | "observation_not_completed" | "requests_unanswered",
  "pairing": ObservationView | null,              // active observation, else the latest
  "candidateSummary": { "poolSize": 6, "listSize": 5 } | null,
  "requestSummary": { "pending": 1, "accepted": 0, "total": 2 } }

// AssessmentDetail = AssessmentView +
{ "candidateList": { "id", "targetSchool", "targetLevel", "poolSize", "listSize", "generatedAt" } | null,
  "candidates": [ TeacherBrief & { "position": 1, "request": RequestView | null } ],
  "requests": [ RequestView ],
  "observations": [ ObservationView ] }           // every attempt, oldest first

// RequestView
{ "id", "assessmentId", "observerId", "status": "pending|accepted|declined|expired|cancelled",
  "requestedAt", "expiresAt", "respondedAt", "observer": TeacherBrief }

// IncomingRequestView = RequestView + { "observee": TeacherBrief, "section": SectionView, "assessmentStatus" }

// ObservationView
{ "id", "assessmentId", "assessmentStatus", "attemptNo", "status": "proposed|approved|rejected|completed|not_completed|postponed",
  "isAcStepin", "sourceListId", "sourceList": { "id", "poolSize", "listSize" } | null,
  "scheduledDate", "observer": TeacherBrief, "observee": TeacherBrief, "section": SectionView,
  "acReviewedAt", "acReviewedBy": "Professor B" | null, "acNotes",
  "observerSignedOffAt", "observeeSignedOffAt", "observeeComment",
  "retryAfter", "notCompletedReason", "createdAt", "updatedAt" }

// GET /assessments/queue
{ "pendingApproval": [ ObservationView & { "assessment": AssessmentView } ],
  "needsAttention": [ AssessmentView ],   // attention != null
  "awaitingSignOff": [ ObservationView ],
  "counts": { "pendingApproval", "needsAttention", "awaitingSignOff" } }
```

Faculty are allowed to see names of candidates, of requesters and of their
observer/observee, so these views carry `TeacherBrief` even though
`GET /teachers` stays committee-only.

## Rules the screens rely on

Taken from `docs/requirements.md` §4.2–4.3 unless marked **added**.

1. **Sign-up**: instructor of the section only; one per section (409);
   **added** – only current/upcoming Spring/Fall terms (409 for past or Summer
   sections; the UI already hides them).
2. **Candidates**: same school + same course level, taught within the look-back
   window, **not teaching a clashing section in that term** (availability from
   schedules), up to 5 picked at random. Calling the endpoint again returns the
   same list (no re-rolling) unless nobody qualified. Zero eligible → the
   sign-up stays `signed_up` and reports `attention: "no_eligible_observers"`;
   persist the 0/0 `candidate_lists` row so the committee dashboard and the
   "unmatched faculty" / "list sufficiency" KPIs can see it (the reference SQL
   comment says not to — the UI needs it).
3. **Requests**: only to people on the latest list; one, several or all; 48 h
   expiry (lazy or scheduled); when one is accepted the other pending ones
   become `cancelled`. Accepting needs a class date that is today or later,
   inside the term, on a day the section meets. Accepting creates the
   `proposed` observation and moves the sign-up to `pending_ac_approval`.
4. **Direct assignment** (`POST /assessments/:id/observations`) is committee
   only. Without `candidateListId` the observer must be an AC member (step-in).
   Non-committee callers get 403 — professors go through requests.
5. **Review**: only `proposed`; rejecting requires `notes`; **added** – a
   reviewer can't be the observer or observee of that pairing (another
   committee member or the admin reviews it). Reject sends the sign-up back to
   `candidates_generated`; approve sets `approved`.
6. **Sign-off**: only `approved`; only observer/observee; not before
   `scheduledDate`; each person once; when both are in, observation and
   sign-up become `completed`.
7. **Completed is immutable**: sign-off, reschedule and not-completed all 409.
   Enforce in the database too (e.g. a trigger that rejects updates when
   `OLD.status = 'completed'`).
8. **Reschedule** clears existing sign-offs. **Not completed** needs a reason,
   sets `retryAfter` (+3 weeks from `app_settings.retry_window_weeks`) and puts
   the sign-up back to `candidates_generated` so the professor can re-request;
   the queue shows it as `observation_not_completed`.
9. `attention: "requests_unanswered"` = requests sent after the last pairing
   exist and all are declined/expired/cancelled.

## Suggested schema additions (new migration — not applied)

- `observer_requests(id, assessment_id, candidate_list_id, observer_id, status, requested_by, requested_at, expires_at, responded_at)` with a composite FK
  `(candidate_list_id, observer_id) → observer_candidates(list_id, teacher_id)`
  so "only people on the list" is enforced by the database, and a partial unique
  index on `(assessment_id, observer_id) WHERE status = 'pending'`.
- `observations`: `request_id`, `observee_comment`, `not_completed_reason`;
  unique index on `(assessment_id) WHERE status IN ('proposed','approved')` so
  two pairings can't be live at once.

## Things the backend has today that will bite during integration

- `POST /assessments/:id/candidates` returns 500 ("could not determine data type
  of parameter $1"): the route passes six values to
  `db/queries/eligible_observers.sql`, whose placeholders run `$1`–`$7` with `$1`
  (assessment id) unused, so every value after it is shifted by one.
- `routes/observations.js` (`/review`) is never mounted in `src/app.js`, so
  `POST /api/observations/:id/review` is a 404.
- `/candidates` can be called at any status and each call inserts a new list
  and resets the sign-up to `candidates_generated`, even after a pairing is
  approved.
- `db/seeds/dev_seed.sql` leaves `start_time`/`end_time` NULL, so the
  schedule-clash check has nothing to compare until sections carry times.

## Not built (outside this task)

View-only roles for Department Head / Annual Review Committee (the `users.role`
check only allows `faculty`, `ac_member`, `admin`), the observation-form
DOCX/upload and process-feedback forms, the rank-based eligibility engine
(first-semester exemption, 2-year cycle, per-professor overrides), the KPI
dashboards, and email/notification delivery.
