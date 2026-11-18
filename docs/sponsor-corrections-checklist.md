# Sponsor Corrections Checklist

Every correction and rule from the sponsor reviews (`docs/requirements.md` change log through 2026-10-21, and the domain rules in `CLAUDE.md`), checked against `main` at `331a57e` on 2026-11-17 for the Nov 18 review. Items that are only partly met are tracked in #138.

How each item was checked: an integration test that covers it, reading the code, or an API call against a local backend. "Open PR" means the fix exists but isn't merged.

| Status | Meaning |
|---|---|
| Done | On `main` and checked |
| Open PR | Fixed in an open PR, not on `main` yet |
| Partial | Some of the rule holds, not all of it |
| Missing | Not on `main` and no PR |

## Blockers for the demo

1. **An observee can't propose their own class at its real time.** `POST /assessments/:id/time-options` checks each slot against the observee's teaching schedule, and the observed section is on that schedule. Proposing CS1337.001 on a Monday at 09:00–10:15 (its real time) returns 409 "conflicts with the observee's own schedule: teaching CS1337.001". Tests use 06:00, so they never hit this. The same check runs when the observee finalizes and when the observer confirms. **#136, fixed in #137.**
2. **A postponed sign-up can't be rescheduled once it had a confirmed date** (#134).
3. **No in-app notifications on the backend** (#135). In-app notifications are MVP.

## Evaluation frequency (§4.1)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| Assistant Professor due once per calendar year, in Spring or Fall | 9/30 | Done | `computeDue` in `teachers.js`; `check:due` |
| Associate/Full due every 2 years, Summer excluded | 9/11 | Done | `computeDue`; `kpi-due-by-rank` test |
| Full professors are still evaluated | 9/11 | Done | `frequencyYearsFor` covers every rank |
| Frequency configurable per professor, not by rank alone | 9/11 | Partial | Backend fixes it by rank (`frequencyYearsFor`). Changing rank after a promotion works (#50), but there is no per-professor setting. #138 |
| Professors can update their own rank after a promotion | 9/18 | Done | `teacher rank self-service (#50)` tests |

## Observer matching (§4.2)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| Match by course level (first digit of the course number), graduate levels included | 9/11, 9/18 | Done | `courses.course_level` is generated from the first digit; `eligible_observers.sql` |
| Same department, not just same school | 10/07 | Done | Migration 005; `t.department = $2 AND c.subject = $2` |
| Taught that level at least once in the last 2 years | 10/21 | Done | `app_settings.observer_lookback_years` in the query |
| Never suggest a professor as their own observer | 10/07 | Done | `t.id <> $1` |
| Don't suggest someone teaching at the observee's class time | 10/07 | Partial | Not filtered when the list is built; only checked when dates are sent and confirmed. A conflicted candidate can fill one of the 5 slots and never get a date. #138 |
| At most 3 observations per observer per cycle | 10/07 | Done | #88, #132; `an observer with three commitments...` test |
| Up to 5 candidates, random when more qualify, all when fewer | 9/18 | Done | `ORDER BY random() LIMIT $5` |
| Zero candidates alerts the AC | 9/18 | Open PR | #121 (approved) saves empty pools; #120 adds the alerts endpoint |
| Candidates come from the cycle's sign-ups (signing up adds you to the pool) | 9/18 | Missing | The query uses the whole roster. Its own comment flags this as a known gap. Needs a team decision. #138 |
| A previous observer can be suggested again | 9/18 | Done | No rotation rule in the query |
| One observation per section per semester; no duplicate sign-ups | 10/07 | Done | `signing up for the same section again: 409` test |

## Selection workflow (§4.3)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| No AC approval of pairings anywhere | 9/30 | Done | Migration 003; no approval wording in the UI |
| AC starts observer selection after the sign-up deadline | 9/30 | Open PR | #121 (approved) |
| Observee picks an observer and offers 4–8 dates | 9/30 | Partial | Frontend enforces 4–8 (`RequestPanel`). The server allows 1–8 (`addOptionsBody`). #138 |
| Dates must be real meeting days inside the observation period, rejected by the server | 10/07 | Done | Meeting-day, term, deadline and past-date checks in `POST /:id/time-options` (the real class time is fixed in #137) |
| Offers can go to several observers at once | 10/21 | Done | #75 model; `observee finalizes an accepted offer` tests |
| Observee can withdraw; observer can decline with a reason | 9/30 | Done | #129 |
| Observer confirms one date; no AC step after | 9/30, 10/07 | Done | `lockInDate`; `confirming creates the observation with the date` test |
| AC manual assignment | 10/07 (stretch) | Done (interim rule) | #17; scope question still open (#26) |
| Both observer and observee sign off | 9/30 | Done | `both sign-offs complete the record` test |
| Never delete a sign-up; mark it Postponed and log who, when, why | 9/30 | Partial | Logged in `cancellation_attempts`; rescheduling is broken (#134); attempt history on the profile is in #104 (re-review requested) |
| "Scheduled" is not "Completed" | 9/30 | Done | Status labels in `format.js` |
| A completed observation can't be edited by anyone | 9/18 | Done (API) | No edit or delete routes; `answers can no longer be changed after the observer signed`, `retrying after completion returns 409`. Database-level guard is #102 (open). |
| Observee can attach their own document if they disagree | 9/30 | Partial | Observee comment only; no attachment. #138 |

## Criteria and the observation form (§4.4, §4.5)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| AC can add, edit and remove criteria | 9/30 | Done | `the AC can create, edit, and deactivate a criterion` test |
| One uniform 5-point scale | 10/18 | Done | #85; `a score above the criterion max is rejected` test |
| Template changes apply going forward only | 9/18 | Partial | Removing is a deactivation, so old records keep it. Editing a criterion changes it in place, and completed records look up the current name, so a rename rewrites old records. #138 |
| Observer answers only; can't edit the questions | 9/30 | Done | Only AC/admin can write criteria (`faculty cannot create criteria`) |
| In-app observation form, signed in-app by both | 9/30 | Done | `questionnaire responses` and sign-off tests |
| Results visible to both only after both sign off | 9/30 | Done | `results stay hidden from the participants until both sign off` test |
| Process feedback survey (web form) | 9/11 | Open PR | #133 (backend), #99 (frontend) |

## Access (§4.6, §4.8)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| Observation records are gated, not visible to everyone | 9/11 | Done | `someone who is not the observer or observee: 403` test |
| Department Head and Annual Review Committee: view-only, completed records only | 9/18 | Done | #127; `view-only-roles` tests |
| One login per faculty member for both roles; admin registers and links accounts | 10/07 | Done | `only admin can register new accounts`; teacher link on login |
| No student access; no real SSO needed | 9/18 | Done | Demo accounts only |

## Notifications (§4.9)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| In-app notifications at key milestones (MVP) | 9/30 | Missing | Works on the mock only. Backend has no table or routes (#135). |
| Outbound email | 9/30 (deferred) | Not required | Stretch |

## Semester dates and the AC Professors page (§4.10, §4.11)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| Store sign-up, observation-period and feedback deadlines; expose them in the API | 10/07 | Done | Migrations 009, 010; `GET /terms`, `PATCH /terms/:id/dates` |
| Frontend disables invalid dates | 10/07 | Done | `DatePicker` only offers meeting dates before the deadline |
| AC Professors page: every active professor's due/overdue status, rank, last completed observation, observation and sign-up status | 10/07 | Done | `GET /teachers/report` rows have `rank`, `dueStatus`, `lastCompleted`, `hasCompletedInTerm`, `signUp` |
| Every active professor appears in the lists | 10/07 | Partial | The report returns all 173. List pages using `GET /teachers` stop at 100 (`fetchAllPages` from #127 can fix them). #138 |

## Data (§4.7)

| Rule | Source | Status | Evidence |
|---|---|---|---|
| Professor names are fictional | 9/18 | Done | No real names in seed or import |
| Names are realistic first and last names, not "Professor A" | 10/21 | Open PR | Seed still has "Professor A"; #115 (backend), #116 (frontend) |
| Real course data via a one-time import | 10/18 | Done | #86 `npm run import:coursebook` |

## KPIs (§6)

| KPI | Status | Evidence |
|---|---|---|
| Eligibility accuracy | Partial | Returned as "unavailable" (no verified decisions recorded) |
| Overdue count; faculty due by rank | Done | #110 |
| Participation rate; missing observations | Done | #110 |
| Survey completion | Open PR | #133 |
| Observer utilization; observations per observer; course-level match; list sufficiency; unmatched faculty; outstanding observations | Open PR | #111 (re-review requested) |
| KPI panel on the AC page | Open PR | #118 (approved) |

## Not checked

- Corrections from the 10/28, 11/4 and 11/11 reviews: none are in `docs/requirements.md`, and there are no meeting notes for them in `docs/notes/`. If those reviews changed anything, it should be added here.
- The browser flows themselves. Items were checked through tests, code and the API, not by clicking through the UI.
