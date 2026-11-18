// Runs the request-tracking helpers (src/lib/requestTracking.js, issue #60) against
// the mock's seeded sign-ups, and against a detail with the mock-only fields
// removed (the real backend's shape today). Fails loudly on any problem.
// Run: npm run check:requests
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

const { mockRequest, resetMockData } = await import("../src/lib/mockServer.js")
const { buildRequests, signUpLabels, summarize, matchesFilter, REQUEST_FILTERS } = await import(
  "../src/lib/requestTracking.js"
)
resetMockData()

const PASSWORD = "ChangeMe-Dev-123!"
const tokens = {}
const login = async (email) =>
  (tokens[email] ??= (await mockRequest("/auth/login", { method: "POST", body: { email, password: PASSWORD } })).token)
const call = async (email, path) => mockRequest(path, { token: await login(email) })

// The page's own path: GET /assessments/mine, then GET /assessments/:id for each.
async function requestsFor(email, assessmentId) {
  const mine = (await call(email, "/assessments/mine")).data
  assert.ok(mine.some((item) => item.id === assessmentId), `${email} owns assessment ${assessmentId}`)
  const detail = await call(email, `/assessments/${assessmentId}`)
  return { detail, requests: buildRequests(detail) }
}

const checkOrder = (requests) => {
  for (let i = 1; i < requests.length; i++) {
    assert.ok(requests[i - 1].attemptNo >= requests[i].attemptNo, "newest attempt first")
  }
}
const checkDates = (request) => {
  const days = request.dates.map((date) => date.date)
  assert.deepEqual(days, days.slice().sort(), "proposed dates are sorted")
}

// ---- professor.f@: assessment 3, declined then confirmed
{
  const { detail, requests } = await requestsFor("professor.f@example.edu", 3)
  checkOrder(requests)
  requests.forEach(checkDates)
  const declined = requests.find((r) => r.status === "declined")
  const confirmed = requests.find((r) => r.status === "confirmed")
  assert.ok(declined, "assessment 3 has a declined request")
  assert.ok(confirmed, "assessment 3 has a confirmed request")
  assert.equal(declined.reason, "Teaching conflict on all five dates.")
  assert.ok(declined.dates.length >= 4 && declined.dates.every((d) => !d.isConfirmed), "no check on a declined request")
  assert.equal(confirmed.dates.filter((d) => d.isConfirmed).length, 1, "exactly one confirmed date")
  const record = detail.observations.find((o) => o.attemptNo === confirmed.attemptNo)
  assert.equal(confirmed.confirmedDate, record.scheduledDate, "confirmed date matches the record")
  assert.equal(confirmed.observationId, record.id)
  assert.ok(requests[0] === confirmed, "the newer request comes first")
  assert.deepEqual(summarize(requests), { all: 2, active: 0, confirmed: 1, declined: 1, expired: 0, postponed: 0 })
}

// ---- ac@: assessment 5, expired, confirmed, then the attempt postponed
{
  const { detail, requests } = await requestsFor("ac@example.edu", 5)
  checkOrder(requests)
  requests.forEach(checkDates)
  const expired = requests.find((r) => r.status === "expired")
  const confirmed = requests.find((r) => r.offerStatus === "confirmed")
  const postponed = requests.find((r) => r.status === "postponed")
  assert.ok(expired, "assessment 5 has an expired request")
  assert.ok(confirmed, "assessment 5 has a confirmed request")
  assert.ok(postponed, "assessment 5 has a postponed attempt")
  assert.equal(postponed, confirmed, "the confirmed request is the one whose attempt was postponed")
  assert.equal(postponed.postponeReason, "Out sick that week.", "postpone reason from the attempt log")
  assert.equal(postponed.confirmedDate, detail.observations.find((o) => o.attemptNo === 1).scheduledDate)
  assert.equal(postponed.observationStatus, "postponed")
  assert.ok(postponed.postponedAt)
  assert.deepEqual(summarize(requests), { all: 2, active: 0, confirmed: 0, declined: 0, expired: 1, postponed: 1 })

  // Every request appears under "All" and under exactly one other tab.
  for (const request of requests) {
    const tabs = REQUEST_FILTERS.filter((tab) => matchesFilter(request, tab.id)).map((tab) => tab.id)
    assert.equal(tabs.length, 2, `request ${request.id} is in "all" plus one group (${tabs})`)
  }
}

// ---- faculty@: signed up, nothing sent yet
{
  const mine = (await call("faculty@example.edu", "/assessments/mine")).data
  const current = mine.find((item) => item.status === "signed_up")
  assert.ok(current, "faculty@ has a fresh sign-up")
  const detail = await call("faculty@example.edu", `/assessments/${current.id}`)
  assert.deepEqual(buildRequests(detail), [], "no requests before one is sent")
}

// ---- the real backend's shape: no offers, observations, section or attempts
{
  const detail = await call("ac@example.edu", "/assessments/5")
  const stripped = { ...detail }
  delete stripped.offers
  delete stripped.observations
  delete stripped.section
  delete stripped.attempts
  let requests
  assert.doesNotThrow(() => {
    requests = buildRequests(stripped)
  }, "stripped detail")
  assert.ok(Array.isArray(requests))
  // Rebuilt from timeOptions: one request per observer the dates were offered to.
  assert.ok(requests.some((r) => r.status === "confirmed" && r.dates.some((d) => d.isConfirmed)))
  summarize(requests)

  // Flat course fields, as GET /assessments/:id returns them on main.
  assert.deepEqual(signUpLabels({ courseCode: "CS1337", sectionCode: "CS1337.001" }), {
    course: "CS 1337",
    title: null,
    term: null,
    section: "Section 001",
  })

  // Nothing at all, or garbage, still gives an empty list.
  for (const shape of [null, undefined, {}, { offers: null, timeOptions: null }, { timeOptions: [{}] }, { attempts: [{ type: "postponed" }] }]) {
    assert.doesNotThrow(() => summarize(buildRequests(shape)), JSON.stringify(shape))
    assert.doesNotThrow(() => signUpLabels(shape))
  }
  // A postponed attempt with no request still shows up.
  const lonely = buildRequests({ attempts: [{ id: 1, attemptNo: 1, type: "postponed", reason: "Room closed.", at: "2026-10-01T10:00:00Z" }] })
  assert.equal(lonely.length, 1)
  assert.equal(lonely[0].status, "postponed")
  assert.equal(lonely[0].postponeReason, "Room closed.")
}

console.log("check:requests passed")
