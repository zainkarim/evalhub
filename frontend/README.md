# EvalHub — Frontend

React + Vite + Tailwind v4 frontend for the Assessment Helper MVP.

## Run

```bash
npm install
npm run dev
```

With no `.env.local` the app runs entirely on an in-browser mock API
(`src/lib/mockServer.js`, seeded from `src/lib/mockData.js`), so the whole UI —
including sign-up → committee starts observer selection → one observer + 4–8 dates →
observer confirms a date → sign-off — works without the backend. Changes are kept in
this browser's localStorage; use **Reset demo data** on the login page to start over.

Demo accounts (password `ChangeMe-Dev-123!` for all; the first three exist in
`backend` after `npm run seed`):

| Account | Who | Use it to |
|---|---|---|
| `faculty@example.edu` | Professor C (faculty) | sign up, pick one observer + dates, sign off |
| `ac@example.edu` | Professor B (Assessment Committee) | review sign-ups, start observer selection, resolve alerts |
| `admin@example.edu` | Administrator | committee view, no teaching profile |
| `professor.h@example.edu` | Professor H (mock only) | confirm one of the offered dates, or decline |
| `professor.e@example.edu` | Professor E (mock only) | see a 5-of-6 candidate list |
| `professor.d@example.edu`, `professor.f@example.edu` | mock only | sign off the seeded, already-held observation |

To use the real API, copy `.env.example` to `.env.local` and set `VITE_API_URL`
(the backend listens on port 3000). Nothing else changes; `src/lib/api.js`
switches automatically. Several workflow screens need endpoints the backend doesn't
have yet — see [`docs/api-expectations.md`](docs/api-expectations.md).

## The workflow (docs/requirements.md §4.3)

1. The professor signs up for a section.
2. **After the sign-up deadline** the committee reviews sign-ups (**Sign-up review**)
   and presses **Start Observer Selection** — for one sign-up or for a whole term.
   Until then the professor sees "Waiting for the committee to start observer selection".
3. The system lists up to five candidates. An empty or short pool raises an alert on
   the committee dashboard (0 eligible = urgent, 1–4 = limited pool).
4. The professor picks **one** observer and **4–8 dates**; nothing is sent until the
   dates are chosen, then one request goes to that observer (it expires after 48 hours).
5. The observer **confirms one date**. The pairing is final — **the committee does not
   approve pairings**. The status is *Scheduled / Confirmed*, not *Completed*.
6. After the class both sign off → *Completed*, view-only for everyone.
7. If an attempt doesn't happen it is **never cancelled or deleted**: it is recorded
   (who, when, why), the sign-up is marked *Postponed*, and a new attempt can be
   scheduled. Declined requests, no-responses and withdrawals stay in the **attempt
   history** too.

> **Open question (BLOCKED, requirements §4.3 step 6 / §8):** when the committee assigns
> an observer manually, must the pick come from the eligible pool or can it be any
> faculty member? Not decided — the manual-assignment form keeps its old behaviour and
> is marked `TODO(BLOCKED…)` in `components/CommitteeActions.jsx` and `lib/mockServer.js`.

## Structure

```
src/
  components/   Layout (role-aware nav), ProtectedRoute, StateBlock, StatusBadge,
                SectionInfo, Stepper, CandidatePanel, RequestPanel, ObserverSummary,
                AttemptHistory, PostponeControl, PairingPanel, CommitteeActions,
                IncomingRequest
  context/      AuthProvider + useAuth (JWT in localStorage)
  lib/          api.js (fetch wrapper), useApi.js (loading/error),
                mockServer.js + mockData.js (in-browser API),
                roles.js, format.js, workflow.js (shared helpers)
  pages/        Login, Courses, CourseDetail, Professors, ProfessorDetail,
                Observations, ObservationSignup, AssessmentDetail,
                ObservationRecord, SignupReview
```

## Who sees what

| Page | Faculty | Assessment Committee / admin |
|---|---|---|
| Courses | own sections + sign-up action | all sections, instructors, sign-up status |
| Observations | my sign-ups, requests to observe (dates to confirm), given / received | all sign-ups (filterable); "My observations" tab if they teach |
| Sign-up form | own sections | any professor (sign up on their behalf) |
| Sign-up detail | waiting state, then choose one observer + dates, attempt history | pool and candidates (read-only), request and dates, manual assignment, postpone, attempt history |
| Sign-up review | — (blocked) | alerts, Start Observer Selection (single and bulk; a locked row says when it opens), search + status filter, every sign-up with course, section, meeting, location, observee, pool and candidates |
| Professors | — (blocked) | roster + each professor's sign-ups |
| Observation record | sign off (observer / observee only), postpone, attempt history | view-only, postpone, attempt history |

See [`docs/sprint2-frontend-changes.md`](docs/sprint2-frontend-changes.md) for the
change list and a click-through demo script.
