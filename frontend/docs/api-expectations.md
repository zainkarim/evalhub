# API the frontend expects

The frontend runs on `src/lib/mockServer.js` until `VITE_API_URL` is set. The mock
is the executable version of this document: if a response shape here is unclear,
read the matching route in that file. Field names are camelCase, dates
`YYYY-MM-DD`, errors `{ "error": { "code", "message" } }` (same as
`backend/docs/api-contract.md`). `api.js` shows `error.message` to the user.

Nothing in `backend/` was changed. The workflow follows `docs/requirements.md`
§4.3 as corrected on 2026-09-30:

1. the professor signs up for a section;
2. **after the sign-up deadline the AC clicks Start Observer Selection once** for the
   whole term (not per sign-up, and not an approval);
3. the system lists up to five candidates; an empty or short pool is an AC alert;
4. the professor picks **one** observer and offers **4–8 dates** — nothing is sent
   until the dates are chosen; then **one** request goes to that observer;
5. the observer **confirms one date** (or declines, or lets the 48h window run out);
   the pairing is then final — **there is no AC approval**;
6. after the class both sign off → Completed (immutable);
7. an attempt that doesn't happen is **never cancelled or deleted**: it is logged
   (who, when, why) and marked **Postponed**; rescheduling is a **new attempt**.

Status column: **exists** = already on `main` and used as-is · **extend** = exists
but the frontend needs more · **mock** = mock-only today, needs to be built.

## Endpoints

| Status | Route | Who | Frontend use |
|---|---|---|---|
| exists | `POST /auth/login`, `GET /auth/me` | any | sign-in, role + `teacherId` + name |
| exists | `GET /teachers`, `GET /teachers/:id` | AC/admin (`:id` also self) | roster, sign-up on behalf |
| extend | `GET /terms` | any | needs `signupDeadline` (mock-only today) |
| exists | `GET /courses`, `GET /sections` | any | pickers (frontend sends `pageSize=100`) |
| exists | `POST /assessments/sign-up` | faculty (self), AC/admin | sign-up form |
| extend | `GET /assessments`, `GET /assessments/mine` | AC/admin · faculty | return **AssessmentView** |
| extend | `GET /assessments/:id` | owner, AC/admin | return **AssessmentDetail** |
| mock | `POST /terms/:termId/start-observer-selection` | AC/admin | THE one cycle-wide "Start Observer Selection"; idempotent; see "Cycle and notifications" |
| mock | `PATCH /terms/:id/dates` `{ signupDeadline, observationDeadline, feedbackDeadline }` | AC/admin | edit the cycle dates |
| mock | `GET /notifications/inbox`, `POST /notifications/:id/read`, `POST /notifications/read-all` | professor | in-app messages |
| mock | `POST /notifications/list-reminder` `{ termId, assessmentIds? }` | AC/admin | reminders (Remind / Remind all) to sign-ups still choosing; the first "list is ready" message is sent automatically |
| mock | `GET /assessments/alerts` (`?termId=`) | AC/admin | alerts panel + nav counter |
| exists | `GET /assessments/:id/time-options` | owner, offered observer, AC/admin | return `attemptNo` too |
| extend | `POST /assessments/:id/time-options` `{ options: [{ proposedDate, startTime, endTime }] }` | owner, AC/admin | **4–8** options (backend accepts 1–8) |
| extend | `POST /assessments/:id/time-options/send` `{ teacherId }` | owner, AC/admin | one request to one observer; see notes |
| mock | `POST /assessments/:id/time-options/withdraw` `{ reason? }` | owner, AC/admin | take the request back |
| mock | `POST /assessments/:id/time-options/decline` `{ reason? }` | the offered observer | decline, reason optional |
| mock | `GET /time-options/incoming` | faculty / AC with a teacher profile | requests sent to me (`{ data: IncomingOfferView[] }`) |
| extend | `POST /time-options/:id/confirm` | the offered observer | observer confirms one date; see notes |
| extend | `POST /assessments/:id/observations` | **AC/admin only** | manual assignment; body adds required `scheduledDate`; see the BLOCKED note |
| mock | `GET /assessments/:id/step-in-options` | AC/admin | committee members who can step in |
| mock | `POST /assessments/:id/postpone` `{ reason }` | AC/admin | **reason required**; logs the attempt; replaces `…/cancel` |
| mock | `GET /observations` (`?status=`) | faculty → own given/received; AC/admin → all | `{ data: ObservationView[] }` |
| mock | `GET /observations/:id` | observer, observee, AC/admin | record page (adds `attempts`) |
| mock | `POST /observations/:id/sign-off` `{ comment? }` | observer or observee | `comment` is the observee's perspective |
| mock | `POST /observations/:id/postpone` `{ reason }` | observer, observee, AC/admin | scheduled attempt didn't happen; replaces reschedule / "it didn't happen" |

**Not used any more:** `POST /assessments/:id/cancel` (the frontend never cancels a
sign-up), `POST /observations/:id/review` (no AC approval), the old
`/assessments/queue`, `/assessments/:id/requests`, `/observer-requests/*`,
`/observations/:id/reschedule` and `/observations/:id/not-completed`.

## Shapes

```jsonc
// TeacherBrief
{ "id": 3, "firstName": "Professor", "lastName": "C", "email": "...", "rank": "assistant_professor", "school": "ECS" }

// SectionView = the flat section + nested course and term
{ "id": 21, "sectionNumber": "001", "meetingDays": "MW", "startTime": "13:00", "endTime": "14:15",
  "location": "ECSW 1.315",
  "course": { "id": 1, "subject": "CS", "courseNumber": "1337", "title": "...", "courseLevel": 1, "school": "ECS" },
  "term":   { "id": 10, "season": "fall", "year": 2026, "startDate": "2026-08-17", "endDate": "2026-12-11",
              "signupDeadline": "2026-09-26" /* mock-only */ } }

// TimeOption (backend shape from migration 004) + a mock-only attemptNo
{ "id", "assessmentId", "proposedDate": "2026-10-12", "startTime": "13:00", "endTime": "14:15",
  "offeredToTeacherId": 8 | null, "isConfirmed": false, "attemptNo": 1 }

// OfferView — one request sent to one observer (mock-only)
{ "id", "assessmentId", "observerId", "attemptNo",
  "status": "pending|confirmed|declined|expired|withdrawn",
  "sentAt", "expiresAt" /* +48h */, "respondedAt", "reason", "observer": TeacherBrief,
  "options": [ TimeOption ] }

// AssessmentView (list rows) — existing assessment fields plus:
{ "teacher": TeacherBrief, "section": SectionView,
  "signupDeadline": "2026-09-26" | null,           // mock-only, from the term
  "selectionStartedAt": "2026-10-13T…" | null,     // mock-only: when the committee clicked Start Observer Selection for the term
  "alert": null | "no_eligible_observers" | "limited_pool",
  "attemptNo": 1,                                  // the attempt that is current / next
  "pairing": ObservationView | null,               // scheduled attempt, else the latest
  "candidateSummary": { "poolSize": 1, "listSize": 1 } | null,   // null = selection not started
  "observerList": [ TeacherBrief ],                // the up-to-five names; [] before selection (mock-only)
  "listReadyNotifiedAt": "2026-10-13T…" | null,    // when "your list is ready" was sent (mock-only)
  "offer": OfferView | null }                      // the request still waiting for a reply
// status: signed_up | candidates_generated | approved | completed | postponed | not_eligible
// `approved` is the backend's key and means "Scheduled / Confirmed" (not Completed).

// AssessmentDetail = AssessmentView +
{ "candidateList": { "id", "targetSchool", "targetLevel", "poolSize", "listSize", "generatedAt" } | null,
  "candidates": [ TeacherBrief & { "position": 1 } ],
  "timeOptions": [ TimeOption ],                   // every attempt
  "offers": [ OfferView ],                         // every request, oldest first
  "observations": [ ObservationView ],             // every attempt, oldest first
  "attempts": [ AttemptLogEntry ] }                // the history, oldest first

// AttemptLogEntry — append-only, never edited or removed (mock-only)
{ "id", "assessmentId", "attemptNo",
  "type": "list_generated|request_sent|request_declined|no_response_expired|request_withdrawn|date_confirmed|ac_assigned|did_not_happen|postponed",
  "by": { "name": "Professor D", "role": "faculty|ac_member|admin|system" }, "at",
  "reason": string | null, "observer": TeacherBrief | null, "date": "YYYY-MM-DD" | null, "count": 5 | null }

// IncomingOfferView = OfferView + { "observee": TeacherBrief, "section": SectionView, "assessmentStatus" }

// ObservationView — one attempt
{ "id", "assessmentId", "assessmentStatus", "attemptNo", "status": "approved|completed|postponed",
  "isAcStepin", "sourceListId", "sourceList": { "id", "poolSize", "listSize" } | null,
  "scheduledDate", "observer": TeacherBrief, "observee": TeacherBrief, "section": SectionView,
  "observerSignedOffAt", "observeeSignedOffAt", "observeeComment", "retryAfter", "createdAt", "updatedAt" }

// GET /assessments/alerts
{ "data": [ AssessmentView ],        // alert != null, urgent first
  "postponed": [ AssessmentView ], "awaitingSignOff": [ ObservationView ],
  "counts": { "urgent", "limited", "postponed", "awaitingSignOff" } }
```

Faculty are allowed to see names of candidates, of the observer they asked and of
their observer/observee, so these views carry `TeacherBrief` even though
`GET /teachers` stays committee-only.

## Rules the screens rely on

From `docs/requirements.md` §4.2–4.3 unless marked **added**.

1. **Sign-up**: instructor of the section only; one per section (409); **added** –
   only current/upcoming Spring/Fall terms. **Added:** a faculty sign-up is refused
   (409, "Sign-ups closed on <date>.") once the term's sign-up deadline has passed (the
   deadline day itself is open), not when Start is clicked. The committee can still sign a
   professor up; if selection has started, that sign-up gets its list (and, when the list
   is non-empty, its "list is ready" message) at once. Other lists are not re-rolled.
2. **Sign-up deadline** (**mock-only**, `terms.signupDeadline`): selection opens the
   day after it. Before that Start returns 409 and the UI shows "Opens after <date>".
   The professor sees "Observer selection opens after the sign-up deadline (<date>).
   You will get a notification when your list is ready."
3. **Start Observer Selection**: ONE cycle-wide action per term, AC/admin only, via
   `POST /terms/:termId/start-observer-selection` (mock). It builds the list for every
   sign-up in the term that has none, using the same pool rules as
   `db/queries/eligible_observers.sql` plus availability from schedules; up to 5 chosen
   at random. It is **idempotent** for sign-ups that already have a non-empty list: a
   later call (`alreadyStarted: true`) never re-rolls them and sends nothing twice.
   Sign-ups whose list is **empty** are re-evaluated on every call ("Re-check empty
   lists" in the UI, shown while any exist after selection started): if an observer is
   eligible now, the list is generated and `list_ready` is sent; if nobody is, nothing
   changes (no new list, no history row) and the call reports it in `stillEmpty`. It approves nothing, and there is no
   per-sign-up start. The professor can use the list as soon as it exists. Generating a
   non-empty list (Start, re-check or a late committee sign-up) sends one `list_ready`
   message per list; an empty list sends none. Zero eligible keeps the sign-up `signed_up` and
   still **persists the 0/0 list** so the alert and the "unmatched faculty" / "list
   sufficiency" KPIs can see it (the reference route currently returns without saving
   one). The list is recorded in the attempt history as `list_generated` by "System".
   The backend's `POST /assessments/:id/candidates` is not used by the frontend.
4. **Insufficient pool**: `poolSize = 0` → `no_eligible_observers` (urgent);
   `1–4` → `limited_pool` (notice). Both feed the dashboard alerts and the nav
   counter. The requirements define only the zero case; **1–4 is our proposal**
   (confirm with the TA). An alert clears once an attempt is scheduled or the
   sign-up is postponed.
5. **Request**: the professor picks **one** person from the latest list and **4–8**
   class dates (a class meeting in the term, today or later). Nothing is sent until
   the dates are chosen. Only one request can be waiting at a time; to ask someone
   else, withdraw it (or wait for it to be declined / expire).
6. **48h expiry** (**added**, kept from the 9/18 notes): a request nobody answers in
   48 hours becomes `expired`; the observer who never replied is written to the
   attempt history and the dates are freed for another observer.
7. **Decline** (**mock-only**): optional reason, kept on the record; the professor
   picks another observer.
8. **Confirm**: only the offered observer, only a future date, exactly one. That
   makes the pairing final: the attempt is `approved` ("Scheduled / Confirmed") and
   the sign-up `approved`. No committee step follows.
9. **Manual assignment** (`POST /assessments/:id/observations`) is AC/admin only and
   schedules directly. **`TODO(BLOCKED: requirements §4.3 step 6 / §8)`** — whether the
   pick must come from the eligible pool or may be any faculty member is **not
   decided**. The mock keeps the old behaviour (a candidate-list member, or an AC
   member as step-in). Note the real route already enforces "only when the pool is
   empty"; that is a backend choice nobody has confirmed.
10. **Sign-off**: only a scheduled attempt; only observer/observee; not before
    `scheduledDate`; each person once; when both are in, observation and sign-up
    become `completed`.
11. **Completed is immutable**: sign-off and postpone both 409. Enforce in the
    database too (e.g. a trigger that rejects updates when `OLD.status = 'completed'`).
12. **Postpone** (AC from the sign-up, or either party / AC from the record):
    **reason required**; the attempt becomes `postponed`, the sign-up `postponed`,
    a waiting request is withdrawn, and a log entry records who, when and why.
    Nothing is deleted. Scheduling again from a postponed sign-up starts
    `attemptNo + 1` (same candidate list, new dates).

## Gaps between the mock and the backend on `main`

These are the places the mock goes beyond (or deliberately differs from) the real
routes, so the backend team can see what integration needs:

- `POST /assessments/:id/candidates` lets the **owner** call it and has no deadline.
  The workflow needs it AC/admin-only after `signupDeadline`, plus a bulk form.
- `POST /time-options/:id/confirm` only sets `is_confirmed`. It should also create
  the attempt (`observations` row with `scheduled_date`, `status = 'approved'`) and
  move `assessments.status` to `approved`.
- `assessment_time_options` has a unique index allowing **one confirmed option per
  assessment**, which blocks a second attempt after a postponement. It needs an
  `attempt_no` (and the index scoped to it); `…/time-options/send` should only touch
  the current attempt's options (today it re-offers every unconfirmed row).
- `time-options` accepts 1–8 options; the requirements say 4–8.
- There is no decline, withdraw, 48h expiry, attempt log (who/when/why) or alerts
  route, and no sign-up deadline column.
- `POST /assessments/:id/cancel` still exists and sets `cancelled`; the requirements
  say never to cancel a sign-up. It should be retired in favour of postpone.
- `routes/observations.js` is not mounted in `src/app.js`, so there is no
  `/observations` list, `/observations/:id` or sign-off route yet.
- §4.2 "Observer Pool": the pool should be limited to professors who signed up this
  cycle; `eligible_observers.sql` (and the mock) use the full roster.
- `db/seeds/dev_seed.sql` leaves `start_time` / `end_time` NULL, so the schedule-clash
  check has nothing to compare, and the request form asks for class times itself.

## Suggested schema additions (new migration — not applied)

- `terms.signup_deadline DATE`.
- `assessment_time_options.attempt_no SMALLINT NOT NULL DEFAULT 1`, with the
  one-confirmed index on `(assessment_id, attempt_no) WHERE is_confirmed`.
- `observer_requests(id, assessment_id, attempt_no, observer_id, status, requested_by, requested_at, expires_at, responded_at, reason)`
  — one row per request to one observer (replaces tracking it only via
  `offered_to_teacher_id`, which loses declines and expiries).
- `assessment_attempt_log(id, assessment_id, attempt_no, type, actor_user_id, actor_name, observer_id, reason, event_date, created_at)`
  — append-only (no UPDATE/DELETE).

## Cycle and notifications (all mock-only; the backend has none of this)

```jsonc
// Term, with the cycle dates added
{ "id": 10, "season": "fall", "year": 2026, "startDate": "...", "endDate": "...", "isLongTerm": true,
  "signupDeadline": "2026-10-03", "observationDeadline": "2026-11-22", "feedbackDeadline": "2026-12-07",
  "selectionStartedAt": null | "2026-10-13T…" }

// POST /terms/:termId/start-observer-selection  (AC/admin; 409 before the day after signupDeadline)
{ "termId": 10, "alreadyStarted": false, "startedAt": "…", "started": 5, "noEligible": 1, "limited": 1, "full": 3 }
// "stillEmpty": empty-list sign-ups re-checked that still have nobody eligible.
// second call: { "alreadyStarted": true, "started": 0, "stillEmpty": n, … }; non-empty lists are untouched

// PATCH /terms/:id/dates  { signupDeadline, observationDeadline, feedbackDeadline }  (AC/admin)
// -> the term. 400 unless sign-up < observation < feedback; 409 to move the sign-up deadline after selection started.

// Notification (what a professor sees)
{ "id": 1, "type": "list_ready" | "list_reminder", "termId": 10, "subject": "Your observer list is ready", "body": "…",
  "link": "/assessments/1" | null, "createdAt": "…", "readAt": null | "…", "sentBy": { "name": "Professor B" }, "channel": "in_app" }
// GET  /notifications/inbox        -> { "data": [ Notification ], "unread": 1 }       (needs a teacher profile)
// POST /notifications/:id/read     -> Notification;   POST /notifications/read-all -> { "unread": 0 }

// POST /notifications/list-reminder  { termId, assessmentIds? }   (AC/admin; 409 before selection has run)
// -> { "sent": 4, "skipped": 3 }  — a type "list_reminder" message for each sign-up still choosing
//    (status candidates_generated with a non-empty list); approved, completed, postponed and
//    empty-list sign-ups are skipped. Reminders are optional: nothing depends on them.
```

Notifications are in-app only; **email delivery is not implemented**. No step waits
for a notification (requirements §5): the list is usable as soon as it exists.

Suggested backend additions: `terms.signup_deadline`, `terms.observation_deadline`,
`terms.feedback_deadline`, `terms.selection_started_at`, and a `notifications` table
(`recipient_teacher_id`, `type`, `term_id`, `assessment_id`, `subject`, `body`,
`created_at`, `read_at`, `sent_by`).

## Not built (outside this task)

View-only roles for Department Head / Annual Review Committee (the `users.role`
check only allows `faculty`, `ac_member`, `admin`), the observation-form and
process-feedback forms, the rank-based eligibility engine, KPI dashboards, and
email delivery. The AC reminders (due/overdue, deadlines), the end-of-process survey
request, the Professors page with due logic, and the criteria editor are later phases.
The Cycle page is the AC's landing page until the KPI dashboards exist.
