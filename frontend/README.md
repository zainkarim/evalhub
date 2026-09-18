# EvalHub — Frontend

React + Vite + Tailwind v4 frontend for the Assessment Helper MVP.

## Run

```bash
npm install
npm run dev
```

With no `.env.local` the app serves sample data from `src/lib/mockData.js`, so
the UI runs without the backend. Sign in with:

- Assessment Committee — `ac@utdallas.edu` / `acdemo`
- Faculty — `anita.rao@utdallas.edu` / `facdemo`

To hit the real API, copy `.env.example` to `.env.local` and set `VITE_API_URL`.
Nothing else changes; `src/lib/api.js` switches automatically.

## Structure

```
src/
  components/   Layout (nav shell), ProtectedRoute, StateBlock
  context/      AuthProvider + useAuth (JWT in localStorage)
  lib/          api.js (fetch wrapper), useApi.js (loading/error), mockData.js
  pages/        Login, Courses, CourseDetail, Professors, ProfessorDetail
```

## API contract this frontend expects

| Method | Route | Response |
|---|---|---|
| POST | `/auth/login` | `{ token, user: { id, name, email, role } }` |
| GET | `/auth/me` | `user` |
| GET | `/professors` | `Professor[]` |
| GET | `/professors/:id` | `Professor` |
| GET | `/courses?term=&search=` | `Course[]` |
| GET | `/courses/:id` | `Course` |

`role` is `AC` or `FACULTY`. All routes except login expect
`Authorization: Bearer <token>`; a 401 clears the token and returns the user to
the login screen. Errors should return `{ "message": "..." }`.

Object shapes are documented by example in `src/lib/mockData.js` — backend team
should match those field names.
