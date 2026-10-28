// Exercises the in-browser mock API directly (no browser): the cycle-wide Start
// Observer Selection (and its empty-list re-check), alerts, the automatic "list
// ready" message, Remind, sign-up rules and the unchanged request path. Fails loudly on any problem.  Run: npm run check:mock
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
assert.equal(await statusOf(post(AC, "/notifications/list-reminder", { termId: fall.id })), 409, "no Remind before selection")

// Moving the deadline to today still means "not yet": it opens the day AFTER.
const todayIso = iso(new Date())
const later = iso(new Date(Date.now() + 40 * 86400000))
const latest = iso(new Date(Date.now() + 80 * 86400000))
await call(AC, `/terms/${spring.id}/dates`, {
  method: "PATCH",
  body: { signupDeadline: todayIso, observationDeadline: later, feedbackDeadline: latest },
})
assert.equal(await statusOf(post(AC, startPath(spring))), 409, "deadline day itself is still before the day after")
const springSection = (await call(AC, "/sections")).data.find((s) => s.termId === spring.id)
assert.ok(springSection, "a Spring 2027 section exists")
const springOwner = await loginEmail(springSection.teacherId)
const springSignUp = await post(springOwner, "/assessments/sign-up", { sectionId: springSection.id })
assert.equal(springSignUp.status, "signed_up", "faculty can still sign up on the deadline day")

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
// The seed has one waiting sign-up (Professor C); add one more before the click.
for (const sectionId of [20]) {
  const sec = (await call(AC, "/sections")).data.find((s) => s.id === sectionId)
  await post(AC, "/assessments/sign-up", { sectionId, teacherId: sec.teacherId })
}
const waiting = (await inTerm(fall)).filter((a) => !a.candidateSummary && a.status === "signed_up")
assert.equal(waiting.length, 2, "two sign-ups are waiting for a list")
const first = await post(AC, startPath(fall))
assert.equal(first.alreadyStarted, false)
assert.equal(first.started, waiting.length, "one click covers every waiting sign-up")
assert.equal(first.started, first.noEligible + first.limited + first.full)
const afterFirst = await inTerm(fall)
const listReady = async (email) =>
  (await call(email, "/notifications/inbox")).data.filter((n) => n.type === "list_ready")
const waitingIds = new Set(waiting.map((a) => a.id))
const justListed = afterFirst.filter((a) => waitingIds.has(a.id) && a.candidateSummary.listSize > 0)
const justEmpty = afterFirst.filter((a) => waitingIds.has(a.id) && a.candidateSummary.listSize === 0)
for (const a of justListed) {
  const email = await loginEmail(a.teacherId)
  const mine = (await listReady(email)).filter((n) => n.link === `/assessments/${a.id}`)
  assert.equal(mine.length, 1, `sign-up ${a.id} got its list_ready message from Start itself`)
  assert.notEqual(a.listReadyNotifiedAt, null)
}
for (const a of justEmpty) {
  const email = await loginEmail(a.teacherId)
  assert.equal((await listReady(email)).filter((n) => n.link === `/assessments/${a.id}`).length, 0, "an empty list sends no message")
}
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
assert.equal(
  (await listReady(FACULTY)).length,
  justListed.filter((a) => a.teacherId === before.teacherId).length,
  "Professor C has one list_ready message per new list; the second click sent none",
)
assert.equal(second.started, 0, "no empty list gained an observer, so nothing new")

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

// ---- the professor was told automatically and can use the list straight away
const detail = await call(FACULTY, `/assessments/${before.id}`)
assert.ok(detail.candidates.length >= 1 && detail.candidates.length <= 5, "list is visible")
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

// ---- Remind / Remind all: reminders only, and only for sign-ups still choosing
const choosing = (await inTerm(fall)).filter((a) => a.status === "candidates_generated" && a.candidateSummary?.listSize > 0)
const everyone = await inTerm(fall)
assert.ok(choosing.length >= 1 && choosing.length < everyone.length, "some sign-ups are still choosing and some are not")
assert.equal(await statusOf(post(FACULTY, "/notifications/list-reminder", { termId: fall.id })), 403, "only the AC can remind")
const countOf = async (email, type) => (await call(email, "/notifications/inbox")).data.filter((n) => n.type === type).length
assert.equal(before.status, "signed_up")
assert.equal((await call(FACULTY, `/assessments/${before.id}`)).status, "approved", "Professor C already scheduled")
const approvedOne = await post(AC, "/notifications/list-reminder", { termId: fall.id, assessmentIds: [before.id] })
assert.deepEqual(approvedOne, { sent: 0, skipped: 1 }, "a scheduled sign-up is never reminded")
assert.equal(await countOf(FACULTY, "list_reminder"), 0)
const remindedAll = await post(AC, "/notifications/list-reminder", { termId: fall.id })
assert.deepEqual(remindedAll, { sent: choosing.length, skipped: everyone.length - choosing.length })
for (const a of everyone) {
  const email = await loginEmail(a.teacherId)
  const expected = choosing.filter((c) => c.teacherId === a.teacherId).length
  assert.equal(await countOf(email, "list_reminder"), expected, `${email} has a reminder only per sign-up still choosing`)
}
for (const a of everyone.filter((x) => !choosing.some((c) => c.id === x.id))) {
  const email = await loginEmail(a.teacherId)
  const mine = (await call(email, "/notifications/inbox")).data.filter((n) => n.link === `/assessments/${a.id}` && n.type === "list_reminder")
  assert.equal(mine.length, 0, `sign-up ${a.id} (${a.status}) is not reminded`)
}
assert.equal((await call(AC, "/notifications/inbox")).data.filter((n) => n.type === "list_reminder").length, choosing.filter((c) => c.teacherId === 2).length)

// ---- inbox basics
let inbox = await call(FACULTY, "/notifications/inbox")
const unreadBefore = inbox.unread
assert.ok(unreadBefore >= 1)
const target = inbox.data[0].id
await post(FACULTY, `/notifications/${target}/read`)
inbox = await call(FACULTY, "/notifications/inbox")
assert.equal(inbox.unread, unreadBefore - 1)
assert.ok(inbox.data.find((n) => n.id === target).readAt)
await post(FACULTY, "/notifications/read-all")
assert.equal((await call(FACULTY, "/notifications/inbox")).unread, 0)
const eMail = justListed.find((a) => a.teacherId !== before.teacherId)
const eEmail = await loginEmail(eMail.teacherId)
await post(eEmail, "/notifications/read-all")
assert.equal((await call(eEmail, "/notifications/inbox")).unread, 0)
assert.equal(await statusOf(post(FACULTY, `/notifications/${(await call(eEmail, "/notifications/inbox")).data[0].id}/read`)), 404, "can't read someone else's message")

// ---- Spring 2027 opens once its deadline has really passed (deadline moved to yesterday).
// Everybody else is deactivated first, so the one Spring sign-up gets an EMPTY list.
const yesterday = iso(new Date(Date.now() - 86400000))
await call(AC, `/terms/${spring.id}/dates`, {
  method: "PATCH",
  body: { signupDeadline: yesterday, observationDeadline: later, feedbackDeadline: latest },
})
const everyTeacher = (await call(AC, "/teachers")).data
const others = everyTeacher.filter((x) => x.id !== springSection.teacherId)
const setActive = (x, isActive) => call(AC, `/teachers/${x.id}`, { method: "PATCH", body: { isActive } })
for (const x of others) await setActive(x, false)
const opened = await post(AC, startPath(spring))
assert.equal(opened.alreadyStarted, false)
assert.equal(opened.started, 1)
assert.equal(opened.noEligible, 1)
const emptyView = (await inTerm(spring)).find((a) => a.id === springSignUp.id)
assert.equal(emptyView.candidateSummary.listSize, 0, "nobody is eligible, so the list is empty")
assert.equal(emptyView.status, "signed_up")
assert.equal(emptyView.alert, "no_eligible_observers")
assert.equal(emptyView.listReadyNotifiedAt, null)
const toldOnce = async () => (await listReady(springOwner)).filter((n) => n.link === `/assessments/${springSignUp.id}`).length
assert.equal(await toldOnce(), 0, "an empty list sends no message")
const stillNone = await post(AC, startPath(spring))
assert.equal(stillNone.alreadyStarted, true)
assert.equal(stillNone.started, 0)
assert.equal(stillNone.stillEmpty, 1, "re-check found nobody yet")
assert.equal((await call(AC, `/assessments/${springSignUp.id}`)).attempts.length, 1, "a fruitless re-check adds no history")
for (const x of others) await setActive(x, x.isActive) // an observer becomes eligible later
const found = await post(AC, startPath(spring))
assert.equal(found.alreadyStarted, true)
assert.equal(found.started, 1, "the re-check built the list now that observers are eligible")
assert.equal(found.stillEmpty, 0)
const rechecked = await call(AC, `/assessments/${springSignUp.id}`)
assert.equal(rechecked.status, "candidates_generated")
assert.ok(rechecked.candidates.length >= 1)
assert.equal(rechecked.alert === "no_eligible_observers", false, "the urgent alert cleared")
assert.equal(await toldOnce(), 1, "list_ready sent when the re-check found observers")
const settled = await post(AC, startPath(spring))
assert.equal(settled.started, 0)
assert.equal(settled.stillEmpty, 0)
assert.equal(await toldOnce(), 1, "and not again")

// ---- sign-up closes at the deadline (not when Start is clicked)
const fallLists = JSON.stringify((await inTerm(fall)).map((a) => [a.id, a.observerList.map((o) => o.id)]))
const signedSections = new Set((await allSignUps()).map((a) => a.sectionId))
const lateSection = (await call(AC, "/sections")).data.find((s) => s.termId === fall.id && !signedSections.has(s.id) && s.teacherId !== 9)
assert.ok(lateSection, "a Fall 2026 section with no sign-up exists")
const lateOwner = await loginEmail(lateSection.teacherId)
assert.equal(await statusOf(post(lateOwner, "/assessments/sign-up", { sectionId: lateSection.id })), 409, "faculty sign-up refused after the deadline")
const refused = await post(lateOwner, "/assessments/sign-up", { sectionId: lateSection.id }).catch((e) => e)
assert.match(refused.message, /^Sign-ups closed on \d{4}-\d{2}-\d{2}\./)
const lateView = await post(AC, "/assessments/sign-up", { sectionId: lateSection.id, teacherId: lateSection.teacherId })
assert.ok(lateView.candidateSummary, "a committee sign-up after selection gets its list at once")
assert.notEqual(lateView.selectionStartedAt, null)
if (lateView.candidateSummary.listSize > 0) {
  assert.equal(lateView.listReadyNotifiedAt !== null, true)
  assert.equal((await listReady(lateOwner)).filter((n) => n.link === `/assessments/${lateView.id}`).length, 1, "late sign-up is told once")
}
assert.equal(
  JSON.stringify((await inTerm(fall)).filter((a) => a.id !== lateView.id).map((a) => [a.id, a.observerList.map((o) => o.id)])),
  JSON.stringify(JSON.parse(fallLists)),
  "existing lists untouched",
)
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
