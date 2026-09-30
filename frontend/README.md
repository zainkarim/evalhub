# EvalHub — Frontend

React + Vite + Tailwind v4 frontend for the Assessment Helper MVP.

## Run

```bash
npm install
npm run dev
```

With no `.env.local` the app runs entirely on an in-browser mock API
(`src/lib/mockServer.js`, seeded from `src/lib/mockData.js`), so the whole UI —
including the sign-up → candidates → request → AC approval → sign-off workflow —
works without the backend. Changes are kept in this browser's localStorage;
use **Reset demo data** on the login page to start over.

Demo accounts (password `ChangeMe-Dev-123!` for all; the same three exist in
`backend` after `npm run seed`):

| Account | Who | Use it to |
|---|---|---|
| `faculty@example.edu` | Professor C (faculty) | sign up, pick observers, sign off |
| `ac@example.edu` | Professor B (Assessment Committee) | approve pairings, step in |
| `admin@example.edu` | Administrator | committee view, no teaching profile |
| `professor.h@example.edu` | Professor H (mock only) | receive/accept observer requests |
| `professor.e@example.edu` | Professor E (mock only) | see a 5-of-6 candidate list |

To use the real API, copy `.env.example` to `.env.local` and set `VITE_API_URL`
(the backend listens on port 3000). Nothing else changes; `src/lib/api.js`
switches automatically. The workflow screens need endpoints the backend doesn't
have yet — see [`docs/api-expectations.md`](docs/api-expectations.md).

## Structure

```
src/
  components/   Layout (role-aware nav), ProtectedRoute, StateBlock, StatusBadge,
                SectionInfo, Stepper, CandidatePanel, PairingPanel,
                CommitteeActions, ReviewControls, IncomingRequest
  context/      AuthProvider + useAuth (JWT in localStorage)
  lib/          api.js (fetch wrapper), useApi.js (loading/error),
                mockServer.js + mockData.js (in-browser API),
                roles.js, format.js, workflow.js (shared helpers)
  pages/        Login, Courses, CourseDetail, Professors, ProfessorDetail,
                Observations, ObservationSignup, AssessmentDetail,
                ObservationRecord, Approvals
```

## Who sees what

| Page | Faculty | Assessment Committee / admin |
|---|---|---|
| Courses | own sections + sign-up action | all sections, instructors, sign-up status |
| Observations | my sign-ups, requests to observe, given / received | all sign-ups (filterable); "My observations" tab if they teach |
| Sign-up form | own sections | any professor (sign up on their behalf) |
| Sign-up detail | pick observers, follow progress | candidate list (read-only), step in, approve, postpone |
| Approvals | — (blocked) | pairings to approve, needs-attention queue, awaiting sign-off |
| Professors | — (blocked) | roster + each professor's sign-ups |
| Confirmation record | sign off (observer / observee only) | view-only |

See [`docs/sprint2-frontend-changes.md`](docs/sprint2-frontend-changes.md) for
the full change list and a click-through demo script.
