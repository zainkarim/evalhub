// Checks the due-date rules (lib/dueStatus.js) and the Professors report that the
// in-browser mock builds from them (GET /teachers/report, /teachers/:id/profile).
// No browser. Terms are explicit, and wherever a result depends on "today" (the default
// semester, the 2-year course look-back) the mock's today is pinned with setMockToday,
// so the result is the same on any day. Fails loudly on any problem.
// Run: npm run check:due
import assert from "node:assert/strict"
import { register } from "node:module"

// The app's imports omit ".js" (Vite resolves them); teach Node to do the same.
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(specifier, context, next) {
      try { return await next(specifier, context) }
      catch (error) {
        if (specifier.startsWith(".") && !/\\.[a-z]+$/.test(specifier)) return next(specifier + ".js", context)
        throw error
      }
    }`),
)

const store = new Map()
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}

const { computeDue, defaultReportTerm, describeWindow } = await import("../src/lib/dueStatus.js")
const { formatTerm } = await import("../src/lib/format.js")

const spring = (year) => ({ season: "spring", year })
const summer = (year) => ({ season: "summer", year })
const fall = (year) => ({ season: "fall", year })
const status = (rank, last, term, frequencyYears) =>
  computeDue({ rank, lastObservedTerm: last, term, frequencyYears }).status

// ---- Assistant professor: once in every calendar year (the professor's own example)
const ASST = "assistant_professor"
assert.equal(status(ASST, spring(2025), spring(2025)), "not_due")
assert.equal(status(ASST, spring(2025), fall(2025)), "not_due")
assert.equal(status(ASST, spring(2025), spring(2026)), "due")
assert.equal(status(ASST, spring(2025), fall(2026)), "due")
assert.equal(status(ASST, spring(2025), spring(2027)), "overdue")
assert.equal(status(ASST, spring(2025), fall(2027)), "overdue")
assert.equal(describeWindow(computeDue({ rank: ASST, lastObservedTerm: spring(2025), term: fall(2026) }).dueWindow), "Spring 2026 or Fall 2026")
// A Fall observation counts for its calendar year too.
assert.equal(status(ASST, fall(2025), spring(2026)), "due")
assert.equal(status(ASST, fall(2025), fall(2026)), "due")
assert.equal(status(ASST, fall(2025), spring(2027)), "overdue")

// ---- Associate / Full: every 2 years, Summer not counted (the professor's own example)
for (const rank of ["associate_professor", "full_professor"]) {
  assert.equal(status(rank, spring(2025), fall(2025)), "not_due")
  assert.equal(status(rank, spring(2025), spring(2026)), "not_due")
  assert.equal(status(rank, spring(2025), fall(2026)), "not_due")
  assert.equal(status(rank, spring(2025), spring(2027)), "due")
  assert.equal(status(rank, spring(2025), fall(2027)), "overdue")
  assert.equal(status(rank, spring(2025), spring(2028)), "overdue")
  const result = computeDue({ rank, lastObservedTerm: spring(2025), term: spring(2027) })
  assert.equal(formatTerm(result.dueTerm), "Spring 2027")
  assert.equal(result.dueWindow.length, 1)
}
// Fall observation: due the Fall two years later.
assert.equal(status("full_professor", fall(2024), spring(2026)), "not_due")
assert.equal(status("full_professor", fall(2024), fall(2026)), "due")
assert.equal(status("full_professor", fall(2024), spring(2027)), "overdue")

// ---- Summer terms are not counted
// A Summer between the two Springs does not make the gap longer or shorter.
assert.equal(status("associate_professor", fall(2024), summer(2026)), "not_due") // judged as Spring 2026
assert.equal(status("associate_professor", fall(2024), fall(2026)), "due")
// An observation held in Summer counts as the Spring before it.
assert.equal(status("associate_professor", summer(2025), spring(2027)), "due")
assert.equal(status("associate_professor", summer(2025), fall(2026)), "not_due")
assert.equal(status(ASST, summer(2025), fall(2026)), "due")

// ---- Never observed: due, no first-semester exemption
const never = computeDue({ rank: ASST, lastObservedTerm: null, term: fall(2026) })
assert.equal(never.status, "never_observed")
assert.equal(never.dueTerm, null)
assert.equal(computeDue({ rank: "full_professor", lastObservedTerm: null, term: spring(2020) }).status, "never_observed")

// ---- Per-professor override hook (§4.1): e.g. an Associate professor on a yearly cycle
assert.equal(status("associate_professor", spring(2025), spring(2026), 1), "due")
assert.equal(status("associate_professor", spring(2025), spring(2027), 1), "overdue")
assert.equal(status(ASST, spring(2025), fall(2026), 2), "not_due")
assert.equal(status(ASST, spring(2025), spring(2027), 2), "due")

// ---- default semester: the one in progress, else the next Spring/Fall
const terms = [
  { id: 8, season: "spring", year: 2026, startDate: "2026-01-12", endDate: "2026-05-08" },
  { id: 9, season: "summer", year: 2026, startDate: "2026-05-18", endDate: "2026-08-07" },
  { id: 10, season: "fall", year: 2026, startDate: "2026-08-17", endDate: "2026-12-11" },
  { id: 11, season: "spring", year: 2027, startDate: "2027-01-11", endDate: "2027-05-07" },
]
assert.equal(defaultReportTerm(terms, "2026-10-14").id, 10)
assert.equal(defaultReportTerm(terms, "2026-06-15").id, 10, "in Summer, the next Fall")
assert.equal(defaultReportTerm(terms, "2026-12-20").id, 11, "between terms, the next one")
assert.equal(defaultReportTerm(terms, "2030-01-01").id, 11, "after the last term, the last one")

// ---- the mock report
const { mockRequest, resetMockData, setMockToday } = await import("../src/lib/mockServer.js")
const TODAY = "2026-10-14" // inside Fall 2026
resetMockData()

const PASSWORD = "ChangeMe-Dev-123!"
const tokens = {}
const login = async (email) =>
  (tokens[email] ??= (await mockRequest("/auth/login", { method: "POST", body: { email, password: PASSWORD } })).token)
const call = async (email, path, options = {}) => mockRequest(path, { ...options, token: await login(email) })
const statusOf = async (promise) => {
  try {
    await promise
    return 200
  } catch (error) {
    return error.status
  }
}
const AC = "ac@example.edu" // Professor B
const FACULTY = "faculty@example.edu" // Professor C
const FALL_2026 = 10
const SPRING_2027 = 11
const report = async (termId) => call(AC, `/teachers/report${termId ? `?termId=${termId}` : ""}`)
const byLetter = (rows) => Object.fromEntries(rows.data.map((row) => [row.lastName, row]))

// Faculty must not reach either route.
assert.equal(await statusOf(call(FACULTY, "/teachers/report")), 403)
assert.equal(await statusOf(call(FACULTY, "/teachers/3/profile")), 403)

const fall26 = await report(FALL_2026)
setMockToday(TODAY)
assert.equal((await report()).term.id, FALL_2026, "without termId the page opens on the term in progress")
setMockToday("2026-12-20")
assert.equal((await report()).term.id, SPRING_2027, "between terms it opens on the next one")
setMockToday(null) // the sign-off step below uses seed dates that are relative to the real clock
const rows = byLetter(fall26)
assert.equal(fall26.data.length, 10, "every professor is a row, signed up or not")
assert.ok(fall26.data.every((row) => row.isActive))
assert.deepEqual(
  Object.fromEntries(Object.entries(rows).map(([letter, row]) => [letter, row.dueStatus])),
  {
    A: "due", //          associate, last Fall 2024 -> due Fall 2026
    B: "never_observed",
    C: "not_due", //      assistant, last Spring 2026 -> due 2027 (but signed up)
    D: "not_due", //      associate, last Fall 2025 -> due Fall 2027
    E: "overdue", //      assistant, last Fall 2024 -> due 2025, overdue from Spring 2026
    F: "not_due", //      full, last Spring 2025 -> due Spring 2027 (but signed up)
    G: "overdue", //      associate, last Spring 2024 -> due Spring 2026, overdue from Fall 2026
    H: "due", //          assistant, last Spring 2025 -> due 2026
    I: "never_observed",
    J: "never_observed",
  },
)
assert.deepEqual(fall26.counts, {
  due: 5, // A, H + the three never observed
  overdue: 2,
  neverObserved: 3,
  signedUp: 4,
  notSignedUp: 6,
  completed: 0,
})
assert.equal(formatTerm(rows.D.dueTerm), "Fall 2027")
assert.equal(formatTerm(rows.A.dueTerm), "Fall 2026")
assert.equal(describeWindow(rows.H.dueWindow), "Spring 2026 or Fall 2026")
assert.equal(rows.A.rankLabel, "Associate Professor")
assert.equal(rows.A.department, "CS")
assert.equal(rows.I.department, "EPPS")
assert.equal(rows.A.lastCompleted.date, "2024-10-16")
assert.equal(rows.B.lastCompleted, null)

// Signed up but not due, and the other sign-up cases.
assert.equal(rows.C.signUp.course, "CS 1337")
assert.equal(rows.C.signUp.section, "001")
assert.equal(rows.C.currentStatus, "selecting_observer")
assert.equal(rows.C.dueStatus, "not_due")
assert.equal(rows.F.currentStatus, "scheduled")
assert.ok(rows.F.currentDate)
assert.equal(rows.B.currentStatus, "postponed")
assert.equal(rows.B.attempts, 1)
assert.equal(rows.I.currentStatus, "selecting_observer")
assert.equal(rows.A.currentStatus, "none")
assert.equal(rows.A.signUp, null)

// A different semester changes the answers: Spring 2027.
const rows27 = byLetter(await report(SPRING_2027))
assert.equal(rows27.H.dueStatus, "overdue", "assistant, last Spring 2025 -> overdue from Spring 2027")
assert.equal(rows27.C.dueStatus, "due", "assistant, last Spring 2026 -> due in 2027")
assert.equal(rows27.F.dueStatus, "due", "full, last Spring 2025 -> due Spring 2027")
assert.equal(rows27.A.dueStatus, "overdue")
assert.equal(rows27.F.currentStatus, "none", "sign-ups belong to their own term")

// Inactive professors stay in the rows (flagged, so the page can offer "Show inactive" and
// an edit link to reactivate them) but drop out of the counts.
await call(AC, "/teachers/7", { method: "PATCH", body: { isActive: false } })
const withoutG = await report(FALL_2026)
assert.equal(withoutG.data.length, 10)
assert.equal(byLetter(withoutG).G.isActive, false)
assert.equal(withoutG.data.filter((row) => row.isActive).length, 9)
assert.deepEqual(
  withoutG.counts,
  { ...fall26.counts, overdue: 1, notSignedUp: fall26.counts.notSignedUp - 1 },
  "counts cover active professors only (G was overdue and not signed up)",
)
await call(AC, "/teachers/7", { method: "PATCH", body: { isActive: true } })
assert.deepEqual((await report(FALL_2026)).counts, fall26.counts, "reactivating brings G back into the counts")
resetMockData()

// Changing a professor's school re-derives the department; an explicit department wins.
const moved = await call(AC, "/teachers/1", { method: "PATCH", body: { school: "EPPS" } })
assert.equal(moved.department, "EPPS")
assert.equal(byLetter(await report(FALL_2026)).A.department, "EPPS")
const renamed = await call(AC, "/teachers/1", { method: "PATCH", body: { school: "ECS", department: "SE" } })
assert.equal(renamed.department, "SE")
const samedept = await call(AC, "/teachers/1", { method: "PATCH", body: { school: "ECS", rank: "full_professor" } })
assert.equal(samedept.department, "SE", "school unchanged -> department untouched")
resetMockData()

// A new professor who has never signed up appears straight away as Never observed.
const added = await call(AC, "/teachers", {
  method: "POST",
  body: { firstName: "New", lastName: "Hire", email: "new.hire@example.edu", school: "ECS", rank: "assistant_professor", isActive: true },
})
assert.equal(added.department, "ECS", "falls back to the school while the form has no department")
const hire = byLetter(await report(FALL_2026)).Hire
assert.equal(hire.dueStatus, "never_observed")
assert.equal(hire.signUp, null)
resetMockData()

// Completed this semester: the due status still explains why they were due, the
// current status says Completed with the date.
// The observer must complete every active evaluation criterion before signing off.
const activeCriteria = (await call(AC, "/criteria")).data
assert.ok(activeCriteria.length > 0, "the evaluation form has active criteria")
await call("professor.d@example.edu", "/observations/2/responses", {
  method: "POST",
  body: {
    responses: activeCriteria.map((criterion) => ({
      criterionId: criterion.id,
      score: Math.min(4, criterion.maxScore),
    })),
  },
})
// Observer can read saved answers before signing.
const observerRatings = await call("professor.d@example.edu", "/observations/2/responses")
assert.equal(observerRatings.data.length, activeCriteria.length)

// Observee cannot see ratings before the observer signs.
assert.equal(
  await statusOf(call("professor.f@example.edu", "/observations/2/responses")),
  403,
  "observee must not see ratings before observer sign-off",
)

// Observer signs first.
await call("professor.d@example.edu", "/observations/2/sign-off", { method: "POST", body: {} })

// Observee can now review ratings before signing themselves.
const observeeRatings = await call("professor.f@example.edu", "/observations/2/responses")
assert.equal(
  observeeRatings.data.length,
  activeCriteria.length,
  "observee should see all ratings after observer sign-off",
)

// Observee signs after reviewing the ratings.
await call("professor.f@example.edu", "/observations/2/sign-off", { method: "POST", body: {} })
const done = await report(FALL_2026)
const f = byLetter(done).F
assert.equal(f.currentStatus, "completed")
assert.ok(f.currentDate)
assert.equal(f.dueStatus, "not_due", "baseline is the observations finished before the term")
assert.equal(f.lastCompleted.date, f.currentDate)
assert.equal(done.counts.completed, 1)
assert.equal(byLetter(await report(SPRING_2027)).F.dueStatus, "not_due", "observed Fall 2026 -> next due Fall 2028")
resetMockData()

// A request sent for a postponed sign-up reads "Request sent", not "Postponed".
setMockToday(TODAY)
const sendDates = ["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28"] // Professor B's MW class
await call(AC, "/assessments/5/time-options", {
  method: "POST",
  body: { options: sendDates.map((proposedDate) => ({ proposedDate, startTime: "10:00", endTime: "11:15" })) },
})
await call(AC, "/assessments/5/time-options/send", { method: "POST", body: { teacherId: 4 } })
assert.equal(byLetter(await report(FALL_2026)).B.currentStatus, "request_sent")
setMockToday(null)
resetMockData()

// ---- the detail page's profile
setMockToday(TODAY)
const profileC = await call(AC, `/teachers/3/profile?termId=${FALL_2026}`)
assert.equal(profileC.teacher.department, "CS")
assert.equal(profileC.summary.dueStatus, "not_due")
assert.deepEqual(
  profileC.courses.map((course) => [course.course, course.thisTerm]),
  [
    ["CS 1337", true],
    ["CS 2305", true], // the second Fall 2026 section the seed gives Professor C
    ["CS 2305", false], // Spring 2026
    ["CS 1337", false], // Fall 2025
  ],
)
assert.deepEqual(
  [profileC.courses[0].level, profileC.courses[0].department, profileC.courses[0].school],
  [1, "CS", "ECS"],
)
const received = profileC.observations.find((o) => o.role === "observee")
assert.equal(received.status, "completed")
assert.equal(received.partner.lastName, "G")
assert.equal(profileC.signUp.status, "signed_up")

const profileD = await call(AC, `/teachers/4/profile?termId=${FALL_2026}`)
// Observer for F (scheduled) and B (postponed -> not counted).
assert.deepEqual(profileD.observerLoad, { count: 1, cap: 3 })
assert.equal(profileD.observations.filter((o) => o.role === "observer").length, 3)

const profileB = await call(AC, `/teachers/2/profile?termId=${FALL_2026}`)
assert.equal(profileB.signUp.status, "postponed")
assert.ok(profileB.signUp.attempts.some((entry) => entry.type === "did_not_happen"), "attempt history is shown")
assert.equal(await statusOf(call(AC, "/teachers/99/profile")), 404)

// "Last 2 years" is counted back from the mock's today, the same date the observer pool uses.
setMockToday("2028-01-15") // cutoff 2026-01-15: Spring 2026 is in, Fall 2025 is out
const later = await call(AC, `/teachers/3/profile?termId=${FALL_2026}`)
assert.deepEqual(
  later.courses.map((course) => [course.course, formatTerm(course.term)]),
  [
    ["CS 1337", "Fall 2026"],
    ["CS 2305", "Fall 2026"],
    ["CS 2305", "Spring 2026"],
  ],
)
setMockToday(null)

console.log("due checks passed")
