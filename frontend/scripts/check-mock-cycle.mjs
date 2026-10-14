// Exercises the in-browser mock API directly (no browser): the cycle-wide Start
// Observer Selection, alerts, "list ready" notifications, sign-up rules and the
// unchanged request path. Fails loudly on any problem.  Run: npm run check:mock
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
resetMockData()

const PASSWORD = "ChangeMe-Dev-123!"
const tokens = {}
const login = async (email) =>
  (tokens[email] ??= (await mockRequest("/auth/login", { method: "POST", body: { email, password: PASSWORD } })).token)
const call = async (email, path, options = {}) =>
  mockRequest(path, { ...options, token: await login(email) })
const post = (email, path, body) => call(email, path, { method: "POST", body })
const statusOf = async (promise) => {
  try {
    await promise
    return 200
  } catch (error) {
    return error.status
  }
}
const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const AC = "ac@example.edu" // Professor B
const FACULTY = "faculty@example.edu" // Professor C
const ESIGN = "professor.e@example.edu"
// The demo logins for Professors B and C are ac@ and faculty@; the others use their teacher email.
const loginEmail = async (teacherId) =>
  teacherId === 2 ? AC : teacherId === 3 ? FACULTY : (await call(AC, `/teachers/${teacherId}`)).email

const terms = (await call(AC, "/terms")).data
const fall = terms.find((t) => t.season === "fall" && t.year === 2026)
const spring = terms.find((t) => t.season === "spring" && t.year === 2027)
const startPath = (term) => `/terms/${term.id}/start-observer-selection`
const allSignUps = async () => (await call(AC, "/assessments")).data
const inTerm = async (term) => (await allSignUps()).filter((a) => a.dueTermId === term.id)

// ---- who may start, and when
assert.equal(await statusOf(post(FACULTY, startPath(fall))), 403, "faculty must not start selection")
assert.equal(await statusOf(post(AC, startPath(spring))), 409, "refused before the deadline has passed")
assert.equal(spring.selectionStartedAt, null)
assert.equal(await statusOf(post(AC, "/notifications/list-ready", { termId: fall.id })), 409, "no Notify before selection")

// Moving the deadline to today still means "not yet": it opens the day AFTER.
const todayIso = iso(new Date())
const later = iso(new Date(Date.now() + 40 * 86400000))
const latest = iso(new Date(Date.now() + 80 * 86400000))
await call(AC, `/terms/${spring.id}/dates`, {
  method: "PATCH",
  body: { signupDeadline: todayIso, observationDeadline: later, feedbackDeadline: latest },
})
assert.equal(await statusOf(post(AC, startPath(spring))), 409, "deadline day itself is still before the day after")

// ---- before the click: Professor C is waiting, with no list
const before = (await call(FACULTY, "/assessments/mine")).data.find((a) => a.dueTermId === fall.id)
assert.equal(before.status, "signed_up")
assert.equal(before.candidateSummary, null)
assert.deepEqual(before.observerList, [])
assert.equal(before.selectionStartedAt, null)
assert.equal(
  await statusOf(post(FACULTY, `/assessments/${before.id}/time-options/send`, { teacherId: 1 })),
  409,
  "no list yet, so nothing can be sent",
)

// ---- one call builds lists for ALL sign-ups without one
const preexisting = new Map((await inTerm(fall)).filter((a) => a.candidateSummary).map((a) => [a.id, JSON.stringify(a.observerList)]))
// The seed has one waiting sign-up (Professor C); add two more before the click.
for (const sectionId of [20, 23]) {
  const sec = (await call(AC, "/sections")).data.find((s) => s.id === sectionId)
  await post(AC, "/assessments/sign-up", { sectionId, teacherId: sec.teacherId })
}
const waiting = (await inTerm(fall)).filter((a) => !a.candidateSummary && a.status === "signed_up")
assert.equal(waiting.length, 3, "three sign-ups are waiting for a list")
const first = await post(AC, startPath(fall))
assert.equal(first.alreadyStarted, false)
assert.equal(first.started, waiting.length, "one click covers every waiting sign-up")
assert.equal(first.started, first.noEligible + first.limited + first.full)
const afterFirst = await inTerm(fall)
for (const a of waiting) {
  assert.ok(afterFirst.find((x) => x.id === a.id).candidateSummary, `sign-up ${a.id} got a list`)
}
for (const [id, names] of preexisting) {
  assert.equal(JSON.stringify(afterFirst.find((x) => x.id === id).observerList), names, "existing lists are never re-rolled")
}

// ---- second call changes nothing
const snapshot = async () =>
  JSON.stringify(
    await Promise.all(
      (await inTerm(fall)).map(async (a) => {
        const d = await call(AC, `/assessments/${a.id}`)
        return [a.id, d.candidateList?.id ?? null, d.candidates.map((c) => c.id), d.attempts.length]
      }),
    ),
  )
const frozen = await snapshot()
const second = await post(AC, startPath(fall))
assert.equal(second.alreadyStarted, true)
assert.equal(second.started, 0)
assert.equal(await snapshot(), frozen, "list ids, candidates and history are identical after a second click")
assert.equal((await call(FACULTY, "/notifications/inbox")).data.length, 0, "starting sends no messages")

// ---- alerts: zero pool is urgent, short pool is limited, a full list has none
const alerts = (await call(AC, "/assessments/alerts")).data.filter((a) => a.dueTermId === fall.id)
const zero = afterFirst.filter((a) => a.candidateSummary?.poolSize === 0)
const open = (a) => ["signed_up", "candidates_generated"].includes(a.status) // an alert clears once scheduled
const short = afterFirst.filter((a) => open(a) && a.candidateSummary && a.candidateSummary.poolSize > 0 && a.candidateSummary.poolSize < 5)
assert.ok(zero.length >= 1 && short.length >= 1, "seed covers an empty and a short pool")
for (const a of afterFirst.filter((x) => !open(x))) {
  assert.equal(alerts.find((x) => x.id === a.id), undefined, "a scheduled/completed sign-up raises no alert")
}
for (const a of zero) assert.equal(alerts.find((x) => x.id === a.id)?.alert, "no_eligible_observers")
for (const a of short) assert.equal(alerts.find((x) => x.id === a.id)?.alert, "limited_pool")
const counts = (await call(AC, "/assessments/alerts")).counts
assert.ok(counts.urgent >= zero.length && counts.limited >= short.length)
assert.equal("waitingToStart" in counts, false)

// ---- the professor reads and uses their list BEFORE any notification
assert.equal((await call(FACULTY, "/notifications/inbox")).data.length, 0)
const detail = await call(FACULTY, `/assessments/${before.id}`)
assert.ok(detail.candidates.length >= 1 && detail.candidates.length <= 5, "list visible without a notification")
assert.equal(detail.selectionStartedAt !== null, true)

// ---- request path unchanged: 4-8 dates, one observer, observer confirms one date
const section = detail.section
const dates = []
for (let day = 1; dates.length < 8 && day < 200; day++) {
  const d = new Date(Date.now() + day * 86400000)
  if (iso(d) <= section.term.endDate && section.meetingDays.includes("UMTWRFS"[d.getDay()])) dates.push(iso(d))
}
assert.ok(dates.length >= 4, "enough class dates left in the term")
const options = (list) => list.map((proposedDate) => ({ proposedDate, startTime: section.startTime, endTime: section.endTime }))
assert.equal(await statusOf(post(FACULTY, `/assessments/${before.id}/time-options`, { options: options(dates.slice(0, 3)) })), 400, "fewer than 4 dates refused")
assert.equal(await statusOf(post(FACULTY, `/assessments/${before.id}/time-options`, { options: options([...dates, dates[0]].slice(0, 9)) })), 400, "more than 8 dates refused")
await post(FACULTY, `/assessments/${before.id}/time-options`, { options: options(dates.slice(0, 4)) })
const observer = detail.candidates[0]
const outsider = (await call(AC, "/teachers")).data.find((t) => !detail.candidates.some((c) => c.id === t.id) && t.id !== detail.teacherId)
assert.equal(await statusOf(post(FACULTY, `/assessments/${before.id}/time-options/send`, { teacherId: outsider.id })), 409, "only someone on the list")
await post(FACULTY, `/assessments/${before.id}/time-options/send`, { teacherId: observer.id })
const sentView = await call(FACULTY, `/assessments/${before.id}`)
assert.equal(sentView.offer.observerId, observer.id, "exactly one observer")
assert.equal(sentView.offer.options.length, 4)
assert.equal(await statusOf(post(FACULTY, `/assessments/${before.id}/time-options/send`, { teacherId: detail.candidates[1]?.id ?? observer.id })), 409, "one request at a time")
const observerEmail = await loginEmail(observer.id)
const incoming = (await call(observerEmail, "/time-options/incoming")).data.find((r) => r.assessmentId === before.id)
assert.equal(incoming.status, "pending")
await post(observerEmail, `/time-options/${incoming.options[1].id}/confirm`)
const done = await call(FACULTY, `/assessments/${before.id}`)
assert.equal(done.status, "approved", "scheduled/confirmed with no AC step in between")
assert.equal(done.pairing.scheduledDate, incoming.options[1].proposedDate)
assert.equal(done.pairing.observer.id, observer.id)
assert.equal(await statusOf(post(AC, "/observations/1/review")), 404, "no review route exists")
assert.equal(await statusOf(post(AC, `/assessments/${before.id}/approve`)), 404, "no approve route exists")

// ---- Notify / Notify all
const ready = (await inTerm(fall)).filter((a) => a.candidateSummary?.listSize > 0)
const noList = (await inTerm(fall)).filter((a) => !a.candidateSummary || a.candidateSummary.listSize === 0)
assert.equal(await statusOf(post(FACULTY, "/notifications/list-ready", { termId: fall.id })), 403, "only the AC can notify")
const one = await post(AC, "/notifications/list-ready", { termId: fall.id, assessmentIds: [before.id] })
assert.deepEqual(one, { sent: 1, alreadyNotified: 0, noList: 0 })
let inbox = await call(FACULTY, "/notifications/inbox")
assert.equal(inbox.unread, 1)
assert.equal(inbox.data[0].type, "list_ready")
assert.equal(inbox.data[0].link, `/assessments/${before.id}`)
assert.equal((await call(AC, "/notifications/inbox")).unread, 0, "only the notified professor gets it")
const all = await post(AC, "/notifications/list-ready", { termId: fall.id })
assert.equal(all.sent, ready.length - 1, "Notify all skips the one already notified")
assert.equal(all.alreadyNotified, 1)
assert.equal(all.noList, noList.length, "empty lists are not announced")
const repeat = await post(AC, "/notifications/list-ready", { termId: fall.id })
assert.deepEqual(repeat, { sent: 0, alreadyNotified: ready.length, noList: noList.length })
for (const a of ready) {
  const email = await loginEmail(a.teacherId)
  const box = await call(email, "/notifications/inbox")
  const mine = ready.filter((r) => r.teacherId === a.teacherId).length // one message per sign-up with a list
  assert.equal(box.data.filter((n) => n.type === "list_ready").length, mine, `${email} has one message per list`)
  assert.ok(box.data.some((n) => n.link === `/assessments/${a.id}`), `${email} is linked to sign-up ${a.id}`)
}
for (const a of noList) {
  const email = await loginEmail(a.teacherId)
  assert.equal((await call(email, "/notifications/inbox")).data.length, 0, `${email} has no message`)
}
inbox = await call(FACULTY, "/notifications/inbox") // refresh: Notify all added more since the first read
const unreadBefore = inbox.unread
assert.equal(unreadBefore, ready.filter((r) => r.teacherId === before.teacherId).length, "Professor C has one unread message per sign-up with a list")
const target = inbox.data[0].id
await post(FACULTY, `/notifications/${target}/read`)
inbox = await call(FACULTY, "/notifications/inbox")
assert.equal(inbox.unread, unreadBefore - 1)
assert.ok(inbox.data.find((n) => n.id === target).readAt)
await post(FACULTY, "/notifications/read-all")
assert.equal((await call(FACULTY, "/notifications/inbox")).unread, 0)
const eMail = ready.find((a) => a.teacherId !== before.teacherId)
const eEmail = await loginEmail(eMail.teacherId)
await post(eEmail, "/notifications/read-all")
assert.equal((await call(eEmail, "/notifications/inbox")).unread, 0)
assert.equal(await statusOf(post(FACULTY, `/notifications/${(await call(eEmail, "/notifications/inbox")).data[0].id}/read`)), 404, "can't read someone else's message")

// ---- Spring 2027 opens once its deadline has really passed (deadline moved to yesterday)
const yesterday = iso(new Date(Date.now() - 86400000))
await call(AC, `/terms/${spring.id}/dates`, {
  method: "PATCH",
  body: { signupDeadline: yesterday, observationDeadline: later, feedbackDeadline: latest },
})
const opened = await post(AC, startPath(spring))
assert.equal(opened.alreadyStarted, false)
assert.equal((await post(AC, startPath(spring))).alreadyStarted, true)

// ---- sign-up after selection started (Spring 2027, whose selection has just run with no sign-ups)
const fallLists = JSON.stringify((await inTerm(fall)).map((a) => [a.id, a.observerList.map((o) => o.id)]))
const free = (await call(AC, "/sections")).data.find((s) => s.termId === spring.id)
assert.ok(free, "a Spring 2027 section exists")
const owner = await loginEmail(free.teacherId)
assert.equal(await statusOf(post(owner, "/assessments/sign-up", { sectionId: free.id })), 409, "faculty sign-up refused once selection started")
const onBehalf = await post(AC, "/assessments/sign-up", { sectionId: free.id, teacherId: free.teacherId })
assert.ok(onBehalf.candidateSummary, "an AC sign-up on behalf gets its list at once")
assert.notEqual(onBehalf.selectionStartedAt, null)
assert.equal(JSON.stringify((await inTerm(fall)).map((a) => [a.id, a.observerList.map((o) => o.id)])), fallLists, "other terms' lists untouched")
void ESIGN

// ---- cycle dates must be in order
assert.equal(
  await statusOf(call(AC, `/terms/${fall.id}/dates`, { method: "PATCH", body: { signupDeadline: "2026-10-03", observationDeadline: "2026-09-01", feedbackDeadline: "2026-12-01" } })),
  400,
)
assert.equal(await statusOf(call(FACULTY, `/terms/${fall.id}/dates`, { method: "PATCH", body: {} })), 403)

// ---- removed routes stay removed
assert.equal(await statusOf(post(AC, `/assessments/${before.id}/candidates`)), 404)
assert.equal(await statusOf(post(AC, "/assessments/start-selection", { termId: fall.id })), 404)

console.log("mock cycle checks passed")
