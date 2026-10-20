# Sprint 2 frontend — changes, how to view them, how they work

Scope: sign-up flow UI, the committee's Cycle page (dates, the one Start Observer
Selection button, alerts, read-only sign-ups, "list ready" notifications), the professor's observer + dates request, the observer's confirmation, the
sign-off record and the attempt history, with clearly different faculty and
Assessment Committee (AC) views. Frontend only — `backend/` is untouched.

The flow follows `docs/requirements.md` §4.3 as corrected on 2026-09-30: the AC does
**not** approve pairings; it starts observer selection after the sign-up deadline and
handles empty or short pools. An earlier version of this branch modelled an AC
approval gate; that has been removed everywhere (wording, stepper, routes, mock API).

## How to view it

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 — runs on the built-in mock API
```

No backend needed. Sign in from the login page's demo buttons (password
`ChangeMe-Dev-123!`). **Reset demo data** on the login page restores the seed.
Everything is stored in the browser, so to see both sides of a hand-off, sign out and
sign in as the other person in the same browser window.

### Click-through (about 8 minutes)

1. **AC · `ac@example.edu`** (Professor B) lands on **Cycle**. It shows the three cycle
   dates (editable), the **Start Observer Selection** button, the alerts panel with
   **Professor I — No eligible observers** (pool size 0, urgent; the nav badge counts it)
   and a read-only table of every sign-up (course, section, meeting, observee name and
   email, observer list). Fall 2026's sign-up deadline has passed, so selection can start.
   *Details* on a row shows pool/list sizes, candidates, requested observer, offered
   dates and attempt history.
2. Professor C's CS 1337 sign-up says **Not started**. Click **Start Observer
   Selection** once: lists are built for every sign-up in the term without one → pool
   1 · list 1 and a new **Limited pool** alert appears; the badge now reads 2. The
   button now reads "Observer selection started"; nothing else can be started. Use
   **Notify** on a row (or **Notify all**) to send "your list is ready". Pick **Spring
   2027** in the term selector: the deadline is still ahead, so Start is locked ("Opens
   after …").
3. **Faculty · `faculty@example.edu`** (Professor C) → *Observations* → CS 1337. Before
   step 2 the page said "Observer selection opens after the sign-up deadline (date). You
   will get a notification when your list is ready." (no Find button). The list is
   there after step 2 even before **Notify**; the *Notifications* inbox shows the
   message once the AC sends it. Now: **Ask one observer** → pick Professor H → tick **4–8** class
   dates (the button stays disabled until then) → **Send request**.
4. **`professor.h@example.edu`** → *Observations* → the request lists the dates and a
   48-hour timer. **Decline…** (optional reason) — back as Professor C the request is
   marked declined and you can ask again; or pick one date → **Confirm this date**.
   The sign-up is now **Scheduled / Confirmed** (not Completed) and the alert clears.
5. **AC** → Professor I's alert → **Open and resolve** → *Assign an observer manually*
   (Professor B as step-in + a class date). The observation is scheduled straight away;
   nothing is approved. *(Whether the AC may pick outside the eligible pool is an open
   question — this form keeps its old behaviour.)*
6. **`professor.d@example.edu`** → *Observations I'm giving* → **Sign off**, then
   **`professor.f@example.edu`** does the same (and can add "Your perspective"). The
   record becomes **Completed — view-only**: no sign-off or postpone button remains for
   anyone.
7. **Postponed, never cancelled.** Open a scheduled record → **Postpone this attempt…**
   → the reason is required → the sign-up is **Postponed**. Open the sign-up as the
   professor *and* as the AC: the **Attempt history** shows who, when and why. The
   professor sees **Schedule a new attempt** (attempt 2). The seeded Professor B
   sign-up (CS 3354, ac@ → *My observations*) already has a history: an unanswered
   request that expired after 48 hours, a confirmed date, and "Out sick that week."
8. **`professor.e@example.edu`** — sign up CS 3354 (Fall 2026) → AC starts selection →
   "6 eligible · 5 listed". Also sign up for the Spring 2027 section to see the locked
   Start state.
9. As faculty, open `/cycle` or `/professors` directly: "limited to the Assessment
   Committee". (`/review` redirects to `/cycle`.)

## What changed

### New

| File | Purpose |
|---|---|
| `pages/Cycle.jsx` (`/cycle`, committee only; `/review` redirects) | The AC landing page: the three cycle dates (editable), the single cycle-wide **Start Observer Selection** (idempotent, locked until the sign-up deadline has passed), observer-pool alerts, and a read-only table of every sign-up with the observer list and Notify / Notify all. Replaces the old Sign-up review page, which released selection per sign-up. |
| `pages/Notifications.jsx` (`/notifications`) | The professor's in-app inbox ("your observer list is ready"). In-app only; email is not implemented. |
| `components/ObserverSummary.jsx` | Pool/list sizes, candidates, requested observer, offered dates, confirmed date. |
| `components/RequestPanel.jsx` | Professor: one observer + 4–8 class dates, then a single request; pending request with 48h countdown and Withdraw. |
| `components/AttemptHistory.jsx` | Who / when / why for every request, reply and postponement. On the sign-up and record pages, for professor and AC. |
| `components/PostponeControl.jsx` | The one way to stop an attempt: a required reason, a log entry, status Postponed. |

### Removed

`pages/Approvals.jsx` and `components/ReviewControls.jsx` (approve / reject), the
committee-review fields, "Cancel sign-up", "It didn't happen", "Reschedule" and
request "Cancel" — each replaced by Postpone + a logged attempt.

### Rewritten or changed

| File | Change |
|---|---|
| `lib/mockServer.js`, `lib/mockData.js` | New workflow model (see below). State key bumped to `v2`, so an old demo resets itself. |
| `lib/api.js` | New calls; the removed ones are gone. |
| `lib/format.js`, `lib/workflow.js` | Status labels (`approved` → *Scheduled / Confirmed*; no `cancelled`, no approval), alert / offer / history labels, new stepper and "next step" text. |
| `components/CandidatePanel.jsx` | Read-only list with school and request status. No Start button (selection runs once per term from the Cycle page); professors see "opens after the sign-up deadline … you will get a notification when your list is ready". |
| `components/IncomingRequest.jsx` | Offered dates, confirm one, decline with optional reason, 48h countdown. |
| `components/CommitteeActions.jsx` | Manual assignment (kept, labelled "stretch goal", marked BLOCKED) + Postpone (kept; whether the AC should keep it is an open question). No cancel. |
| `components/PairingPanel.jsx`, `Stepper.jsx`, `StatusBadge.jsx` | No committee review; stepper is Signed up → Observer list → Request sent → Scheduled → Sign-off. |
| `pages/AssessmentDetail.jsx`, `ObservationRecord.jsx`, `Observations.jsx`, `ObservationSignup.jsx`, `Login.jsx` | New states, deadline copy, attempt history, alert labels. |
| `components/Layout.jsx`, `App.jsx` | Nav "Cycle" (alert counter) and "Notifications" (unread counter); `/review` redirects to `/cycle`; the AC lands on `/cycle`. |

## How it works

**Roles.** `faculty` and `ac_member`/`admin` get different navigation, landing page,
tables and actions. AC members who teach also take part as professors; on their own
sign-up they act as the professor and another committee member handles any manual
assignment.

**Mock vs real API.** `VITE_API_URL` unset → mock. Set → the same calls go to the
backend. Where the backend lacks a route, or differs from the requirements, it is
listed in [`api-expectations.md`](api-expectations.md). Mock-only additions: the
cycle dates (`signupDeadline`, `observationDeadline`, `feedbackDeadline`, `selectionStartedAt`)
and `PATCH /terms/:id/dates`, the cycle-wide `POST /terms/:id/start-observer-selection`,
in-app notifications ("your list is ready"), decline / withdraw, the 48h request record,
the attempt log, `attemptNo` on time options, and the alerts feed.

**Added rules** (not stated in the docs, easy to remove in `mockServer.js`):
summer / past-term sections can't be signed up; observer selection is locked until
the day after the term's sign-up deadline and runs once for the whole term; a faculty
sign-up after that is refused (the committee can still sign someone up); the professor can only ask people on the list; one
request waits at a time; requests expire after 48 hours; observer confirmation needs a
future date; step-in observers must be AC members; the retry-in-3–4-weeks gate was
dropped in favour of "new attempt in the same semester".

## Verified

`npm run build` and `npx oxlint src` are clean. The mock API was exercised end to end
from a script: committee-only start and the deadline lock (one cycle-wide Start), the 4–8
date rule, one request at a time, only listed observers, decline with a reason,
confirm → Scheduled, alert clearing, postpone → new attempt, 48h expiry logged with
the observer's name, and the completed record being immutable.

## Browser test pass (fixes)

Found and fixed while clicking through the app: the nav alert counter now refreshes after
any write (`api.js` fires `evalhub:changed`, `Layout.jsx` listens); `/review` has a search box
and status filter; a locked row shows "opens after <deadline>" as text, not only a tooltip;
the sign-up date is shown in the viewer's local day; tables no longer widen the page at
390px (`relative` on the scroll wrappers); the seeded request, confirmed and sign-off dates
now fall on each section's meeting days; the request countdown sentence reads correctly;
the "nothing needs approval" / "not cancelled" sentences were dropped from the UI.

## Professors page (issue #63, requirements §4.11)

`/professors` (committee only) now lists the **active professors**, including those who
have not signed up: name, email, department, rank, due status, the semester they are next
due, last completed observation, current observation status and sign-up status. Summary
tiles (Due, Overdue, Not signed up, Signed up, Completed), filters (due status, sign-up,
rank, department), search, sortable columns and a semester picker (default: the current or
next Spring/Fall term). **Add Professor** is unchanged. The detail page adds courses (this
term and the last 2 years back from today, with level and department), observations given and received,
observer load against the 3-observation cap, and the current sign-up with its attempt
history. Nothing is approved and nothing here sends reminders.

**Inactive professors.** The default view is the active professors (§4.11). A **Show
inactive** toggle (default off) adds the inactive ones, each with an Active/Inactive badge
and an **Edit** link to the edit page, so the AC can reactivate them. The tiles (Due,
Overdue, Not signed up, Signed up, Completed) **always count active professors only**,
whatever the toggle says. The chosen semester is kept in the URL (`/professors?termId=`),
so "Back to professors" from a detail page returns to it; the semester list is loaded once,
separately from the report.

| File | Change |
|---|---|
| `lib/dueStatus.js` (new) | The due rules as pure functions (`computeDue`, `describeDue`, `defaultReportTerm`, `DUE_STATUS`). No clock, React or network. |
| `lib/professorSort.js` (new) | Column sorting for the page. |
| `components/ProfessorsTable.jsx` (new) | The sortable table; a comment marks where a future "Send reminder" action goes. |
| `pages/Professors.jsx`, `pages/ProfessorDetail.jsx` | Rewritten as above. |
| `lib/mockServer.js`, `lib/mockData.js` | `GET /teachers/report`, `GET /teachers/:id/profile`; `department`; `observerCap`; mock-only history (state key bumped to `v4`, so an old demo resets itself). |
| `lib/api.js`, `lib/format.js` | `professorReport`, `professorProfile`; current-status labels. |
| `scripts/check-due.mjs` | `npm run check:due`. Pins the mock's "today" (`setMockToday`) wherever a result depends on it, so it passes on any date. |

**Mock history (mock-only, not in `dev_seed.sql`).** Six completed observations from earlier
terms plus two past sections (Professor E, Fall 2024; Professor F, Spring 2025), so the
Fall 2026 view shows every case:

| Professor | Rank | Last observed | Fall 2026 | Sign-up |
|---|---|---|---|---|
| A | Associate | Fall 2024 | Due | no |
| B | Full | never | Never observed | yes, Postponed (1 attempt) |
| C | Assistant | Spring 2026 | Not due yet | yes (signed up but not due) |
| D | Associate | Fall 2025 | Not due yet | no |
| E | Assistant | Fall 2024 | Overdue | no |
| F | Full | Spring 2025 | Not due yet | yes, Scheduled |
| G | Associate | Spring 2024 | Overdue | no |
| H | Assistant | Spring 2025 | Due | no |
| I (EPPS) | Full | never | Never observed | yes, Selecting observer |
| J (EPPS) | Associate | never | Never observed | no |

**Click-through.** Sign in as `ac@example.edu` → **Professors**. Tiles read Due 5 (3 never
observed), Overdue 2, Not signed up 6, Signed up 4, Completed 0. Filter *Overdue* → E and
G. Sort *Next due*. Pick **Spring 2027**: Professor C and F become due, H and A overdue.
Open Professor D: observer load 1 of 3. Then sign off the seeded observation as D and F
(see the demo script above) and come back: F shows Completed with the date, and the
Completed tile reads 1. Signed in as `faculty@example.edu`, `/professors` and
`/professors/:id` show "limited to the Assessment Committee".

**Due logic assumptions** (accepted): an Assistant professor is overdue from the first term
after the due year; a never-observed professor counts as due, never overdue (no hire date);
Summer is not a cycle term (the picker lists Spring and Fall; a Summer observation counts as
the Spring before it); status uses observations completed before the semester starts;
an observation's semester is its section's term.

**For the faculty dashboard** (branch `jj/issue-61-faculty-dashboard`): `lib/dueStatus.js`
is reusable. "The semester that I am due" is
`describeDue(computeDue({ rank, lastObservedTerm, term }))` with the professor's own last
completed observation. It does not touch the clock, so pass the term explicitly. That
branch only adds `pages/FacultyDashboard.jsx` and a route line in `App.jsx`, so it does not
overlap with these files.

## Not included

View-only roles for Department Head / Annual Review Committee (schema has no such
role), the observation-form DOCX/upload, process-feedback form, rank-based
eligibility engine, KPI dashboards, email delivery — later sprints per the plan.
