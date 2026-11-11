# EvalHub Backend (Assessment Helper — Team 08)

Node.js + Express REST API on PostgreSQL. Free / open-source dependencies only.
Scope so far: Sprint 1 (DB models & migrations, Teachers / Terms / Courses / Sections CRUD, basic JWT auth) and the start of Sprint 2 (assessment sign-up API; the matching/observation-review endpoints are still in progress — see docs/api-contract.md).

## Quick start

Requirements: Node ≥ 20.6, Docker (for local Postgres).

```bash
docker compose up -d            # Postgres 16 on :5432
cp .env.example .env            # then set JWT_SECRET (>= 32 chars)
npm install
npm run migrate                 # applies db/migrations/*.sql in order (idempotent — safe to re-run)
npm run seed                    # synthetic dev data + 3 demo logins (refuses in production)
npm run dev                     # API on http://localhost:3000
npm test                        # unit tests (no DB needed)
npm run test:integration        # API tests against a real Postgres (needs the docker DB running)
```

`test:integration` creates and wipes a separate `<your database>_test` database
(e.g. `evalhub_test`) on the same server, runs the migrations and seed into it,
and drives the real app over HTTP. Your dev data is never touched. Override the
target with `TEST_DATABASE_URL`; its name must end in `_test`.

Smoke test:

```bash
curl -s localhost:3000/api/health
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ac@example.edu","password":"ChangeMe-Dev-123!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s "localhost:3000/api/teachers?school=ECS" -H "Authorization: Bearer $TOKEN"
curl -s "localhost:3000/api/courses?school=ECS&level=4" -H "Authorization: Bearer $TOKEN"
```

Demo accounts (dev only): `admin@example.edu` · `ac@example.edu` (Professor B) · `faculty@example.edu` (Professor C); password = `SEED_PASSWORD`. Seed instructors are personas — never use real names in test data. Every other seeded teacher also has a login now, at their own `teachers.email` with the same password.

## Importing real course data (Coursebook / Nebula API)

```bash
# backend/.env needs NEBULA_API_KEY (ask Zain; never commit it)
npm run import:coursebook -- --dry-run   # fetch + filter only, no writes
npm run import:coursebook
```

Pulls real courses, sections, and meeting times from UTD Nebula Labs' API
(`api.utdnebula.com`, the backend behind Coursebook) into `courses` /
`course_sections` / `teachers` with `source = 'coursebook'`. Safe to re-run;
it never overwrites a `manual` or `seed` row.

- **Instructors are pseudonymized.** Professor names must always be fictional,
  so the script never fetches professor records. Each instructor becomes a
  stable fake teacher (`Professor KQZ`, `prof-<hash>@example.edu`) derived from
  their Nebula id, so re-runs and later terms map to the same teacher. Rank
  defaults to `assistant_professor`.
- **Scope:** `NEBULA_SUBJECTS` (default `CS`) and `NEBULA_TERMS` (Nebula session
  names, default `25F,26S,26F`). Keeps face-to-face lecture sections only; skips
  online sections, lab courses, lab sections (`0L1`, …), and sections without
  meeting times, per the 10/14 review.
- About 50 requests for a subject's courses plus about 230 per term; the
  default run takes ~2 minutes and imports ~600 CS sections.

## Layout

```
db/migrations/   versioned SQL (001_initial_schema.sql, 002_assessment_workflow.sql)
db/seeds/        synthetic dev data
db/queries/      reference SQL (observer matching) — not auto-run, for the endpoint that builds on it
docs/            schema.md (ERD), api-contract.md, erd.png
src/routes/      auth, teachers, terms, courses, sections, assessments (sign-up)
src/middleware/  authenticate / requireRole, zod validation, error handler
src/db/          pg pool, migration runner, seed script, SQL helpers
test/            node:test unit tests
integration/     node:test API tests against a real database (*.int.js + harness.js)
```

## Conventions

- API fields are camelCase; DB columns are snake_case (mapped in each route's `to*` serializer).
- All SQL is parameterised; dynamic `SET` clauses use whitelisted column maps (`src/db/sql.js`).
- Schema changes = a **new** numbered file in `db/migrations/`; never edit an applied one.
- Passwords are hashed with bcrypt (`bcryptjs`, pure JS — no native build step on a VM).

## Known limitations

- JWTs stay valid until expiry even if a user is deactivated afterwards (8 h default).
- Login is rate-limited per IP only; no account lockout.
- Auth is local JWT login; the Q&A mentions Single Sign On — see `docs/schema.md` open questions.
- Integration tests cover auth and role checks, sign-up, criteria, questionnaire responses, and sign-off; other routes are not covered yet.
- Assessment sign-up API is built and migrated; the matching/candidate-generation, AC-approval, sign-off and feedback endpoints are not built yet (Sprint 2, in progress).
