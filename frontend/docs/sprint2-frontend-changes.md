# Sprint 2 frontend — changes, how to view them, how they work

Scope: sign-up flow UI, the committee's sign-up review and observer-selection
trigger, the professor's observer + dates request, the observer's confirmation, the
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

1. **AC · `ac@example.edu`** (Professor B) lands on **Sign-up review**. The alerts panel
   shows **Professor I — No eligible observers** (pool size 0, urgent) and the nav
   badge counts it. Fall 2026's sign-up deadline has passed, so selection can start.
   *Details* on a row shows the course, section, meeting, location, observee,
   pool/list sizes, candidates, requested observer, offered dates and attempt history.
2. Professor C's CS 1337 sign-up says **Not started**. Click **Start selection** (or
   **Start for all waiting**) → pool 1 · list 1 and a new **Limited pool** alert
   appears; the badge now reads 2. Pick **Spring 2027** in the term selector: the
   deadline is still ahead, so Start is locked ("Opens after …").
3. **Faculty · `faculty@example.edu`** (Professor C) → *Observations* → CS 1337. Before
   step 2 the page said "Waiting for the committee to start observer selection" (no
   Find button). Now: **Ask one observer** → pick Professor H → tick **4–8** class
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
9. As faculty, open `/review` or `/professors` directly: "limited to the Assessment
   Committee".

## What changed

### New

| File | Purpose |
|---|---|
| `pages/SignupReview.jsx` (`/review`, committee only) | The AC landing page: observer-pool alerts, term + deadline, stage counts, **Start Observer Selection** (bulk + per row), and a table of every sign-up with the data the AC needs to review it. Replaces the old Approvals page. |
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
| `components/CandidatePanel.jsx` | Read-only list with school and request status; committee-only Start button; professors see the waiting state. |
| `components/IncomingRequest.jsx` | Offered dates, confirm one, decline with optional reason, 48h countdown. |
| `components/CommitteeActions.jsx` | Manual assignment (kept, marked BLOCKED) + Postpone. No review, no cancel. |
| `components/PairingPanel.jsx`, `Stepper.jsx`, `StatusBadge.jsx` | No committee review; stepper is Signed up → Observer list → Request sent → Scheduled → Sign-off. |
| `pages/AssessmentDetail.jsx`, `ObservationRecord.jsx`, `Observations.jsx`, `ObservationSignup.jsx`, `Login.jsx` | New states, deadline copy, attempt history, alert labels. |
| `components/Layout.jsx`, `App.jsx` | Nav "Sign-up review" with the alert counter; `/approvals` → `/review`; the AC lands there. |

## How it works

**Roles.** `faculty` and `ac_member`/`admin` get different navigation, landing page,
tables and actions. AC members who teach also take part as professors; on their own
sign-up they act as the professor and another committee member handles any manual
assignment.

**Mock vs real API.** `VITE_API_URL` unset → mock. Set → the same calls go to the
backend. Where the backend lacks a route, or differs from the requirements, it is
listed in [`api-expectations.md`](api-expectations.md). Mock-only additions: the
per-term `signupDeadline`, bulk start, decline / withdraw, the 48h request record,
the attempt log, `attemptNo` on time options, and the alerts feed.

**Added rules** (not stated in the docs, easy to remove in `mockServer.js`):
summer / past-term sections can't be signed up; observer selection is locked until
the day after the term's deadline; the professor can only ask people on the list; one
request waits at a time; requests expire after 48 hours; observer confirmation needs a
future date; step-in observers must be AC members; the retry-in-3–4-weeks gate was
dropped in favour of "new attempt in the same semester".

## Verified

`npm run build` and `npx oxlint src` are clean. The mock API was exercised end to end
from a script: committee-only start and the deadline lock (single and bulk), the 4–8
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

## Not included

View-only roles for Department Head / Annual Review Committee (schema has no such
role), the observation-form DOCX/upload, process-feedback form, rank-based
eligibility engine, KPI dashboards, email delivery — later sprints per the plan.
