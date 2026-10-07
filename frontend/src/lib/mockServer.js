// In-browser stand-in for the EvalHub REST API, used when VITE_API_URL is not
// set (see api.js). State lives in localStorage so a demo survives reloads and
// switching between accounts in the same browser.
//
// Routes marked [backend] exist in backend/docs/api-contract.md or on main today.
// Routes marked [new] are the ones the frontend needs the backend team to add —
// their shapes are documented in frontend/docs/api-expectations.md.
// Business rules come from docs/requirements.md §4.2–4.3 (corrected 2026-09-30):
//   - the AC does NOT approve pairings; it starts observer selection after the
//     sign-up deadline and handles insufficient pools manually
//   - the professor picks ONE observer and offers 4-8 dates; the observer confirms one
//   - an attempt that does not happen is never cancelled: it is logged and Postponed

import { APP_SETTINGS, buildSeed, DEMO_PASSWORD } from "./mockData"

const STORE_KEY = "evalhub.mock.state.v2"
const HOUR = 60 * 60 * 1000
const MIN_DATES = 4
const MAX_DATES = 8

// ---------------------------------------------------------------- state ----

let state = null

function load() {
  if (state) return state
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null")
    if (saved?.version === 2) {
      state = saved
      return state
    }
  } catch {
    // fall through to a fresh seed
  }
  state = buildSeed()
  return state
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: the demo still works for this page load
  }
}

export function resetMockData() {
  state = buildSeed()
  save()
}

// --------------------------------------------------------------- helpers ----

function fail(status, code, message) {
  const error = new Error(message)
  error.name = "ApiError"
  error.status = status
  error.code = code
  return error
}

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

const isoDay = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}
const today = () => isoDay(new Date())
const nowISO = () => new Date().toISOString()
const isAC = (user) => user.role === "ac_member" || user.role === "admin"

const byId = (list, id) => list.find((item) => item.id === Number(id))

function paged(rows, params) {
  const page = Math.max(Number(params.get("page") ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(params.get("pageSize") ?? 25), 1), 100)
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: rows.length,
  }
}

function tokenFor(user) {
  return `mock.${btoa(JSON.stringify({ id: user.id }))}`
}

function userFromToken(token) {
  try {
    const { id } = JSON.parse(atob(token.replace("mock.", "")))
    return byId(load().users, id) ?? null
  } catch {
    return null
  }
}

// Requests nobody answered within 48h become `expired` the next time anyone
// talks to the API (the real backend would do this lazily or on a timer). The
// observer who never replied is written to the attempt log.
function expireOffers() {
  const s = load()
  const now = Date.now()
  let changed = false
  for (const offer of s.offers) {
    if (offer.status === "pending" && new Date(offer.expiresAt).getTime() <= now) {
      offer.status = "expired"
      releaseOptions(offer)
      logAttempt(byId(s.assessments, offer.assessmentId), "no_response_expired", {
        by: { name: "System", role: "system" },
        attemptNo: offer.attemptNo,
        observerId: offer.observerId,
        reason: `No response within ${APP_SETTINGS.requestExpiryHours} hours.`,
        at: offer.expiresAt,
      })
      changed = true
    }
  }
  if (changed) save()
}

// ----------------------------------------------------------- attempt log ----

const actorOf = (user) => {
  const teacher = user.teacherId ? byId(load().teachers, user.teacherId) : null
  return {
    name: teacher ? `${teacher.firstName} ${teacher.lastName}` : user.email,
    role: user.role,
  }
}

// Append-only: who did what, when, and why. Nothing here is edited or removed.
function logAttempt(assessment, type, fields) {
  const s = load()
  s.attemptLog.push({
    id: s.nextId.log++,
    assessmentId: assessment.id,
    attemptNo: fields.attemptNo ?? currentAttemptNo(assessment.id),
    type,
    byName: fields.by.name,
    byRole: fields.by.role,
    at: fields.at ?? nowISO(),
    reason: fields.reason?.trim() || null,
    observerId: fields.observerId ?? null,
    date: fields.date ?? null,
    count: fields.count ?? null,
  })
}

// A postponed or did-not-happen attempt closes that attempt; whatever is
// scheduled next is a new attempt.
const CLOSING = ["postponed", "did_not_happen"]
const currentAttemptNo = (assessmentId) =>
  1 +
  load().attemptLog.filter((row) => row.assessmentId === assessmentId && CLOSING.includes(row.type))
    .length

// ----------------------------------------------------------------- views ----

const teacherBrief = (id) => {
  const t = byId(load().teachers, id)
  return t
    ? {
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        rank: t.rank,
        school: t.school,
      }
    : null
}

const flatSection = (section) => ({
  id: section.id,
  courseId: section.courseId,
  termId: section.termId,
  sectionNumber: section.sectionNumber,
  teacherId: section.teacherId,
  meetingDays: section.meetingDays,
  startTime: section.startTime,
  endTime: section.endTime,
  location: section.location,
  source: section.source,
  externalId: section.externalId,
})

function sectionView(sectionId) {
  const s = load()
  const section = byId(s.sections, sectionId)
  return {
    ...flatSection(section),
    course: byId(s.courses, section.courseId),
    term: byId(s.terms, section.termId),
  }
}

const latestList = (assessmentId) =>
  load()
    .candidateLists.filter((list) => list.assessmentId === assessmentId)
    .sort((a, b) => b.id - a.id)[0] ?? null

// Only a scheduled (confirmed) attempt is "active"; there is no review step.
const activeObservation = (assessmentId) =>
  load().observations.find((o) => o.assessmentId === assessmentId && o.status === "approved") ?? null

const latestObservation = (assessmentId) =>
  load()
    .observations.filter((o) => o.assessmentId === assessmentId)
    .sort((a, b) => b.attemptNo - a.attemptNo)[0] ?? null

const pendingOffer = (assessmentId) =>
  load().offers.find((o) => o.assessmentId === assessmentId && o.status === "pending") ?? null

const unsentOptions = (assessmentId) =>
  load().timeOptions.filter(
    (o) =>
      o.assessmentId === assessmentId &&
      o.attemptNo === currentAttemptNo(assessmentId) &&
      !o.isConfirmed &&
      o.offeredToTeacherId === null,
  )

// Sign-up deadline is mock-only. Selection opens the day after it.
const signupDeadline = (assessment) =>
  byId(load().terms, assessment.dueTermId)?.signupDeadline ?? null
const selectionOpen = (assessment) => {
  const deadline = signupDeadline(assessment)
  return !deadline || today() > deadline
}

// §4.2: zero eligible is urgent; fewer than a full list is a "limited pool"
// notice. Only meaningful once the committee has generated a list, and it
// clears as soon as an attempt is scheduled.
function alertFor(assessment) {
  if (!["signed_up", "candidates_generated"].includes(assessment.status)) return null
  const list = latestList(assessment.id)
  if (!list) return null
  if (list.poolSize === 0) return "no_eligible_observers"
  if (list.poolSize < APP_SETTINGS.candidateListSize) return "limited_pool"
  return null
}

const optionView = (option) => ({
  id: option.id,
  assessmentId: option.assessmentId,
  proposedDate: option.proposedDate,
  startTime: option.startTime,
  endTime: option.endTime,
  offeredToTeacherId: option.offeredToTeacherId,
  isConfirmed: option.isConfirmed,
  attemptNo: option.attemptNo,
})

function offerView(offer) {
  const options = load().timeOptions.filter((o) => offer.optionIds.includes(o.id))
  return {
    id: offer.id,
    assessmentId: offer.assessmentId,
    observerId: offer.observerId,
    attemptNo: offer.attemptNo,
    status: offer.status,
    sentAt: offer.sentAt,
    expiresAt: offer.expiresAt,
    respondedAt: offer.respondedAt,
    reason: offer.reason,
    observer: teacherBrief(offer.observerId),
    options: options
      .sort((a, b) => a.proposedDate.localeCompare(b.proposedDate))
      .map(optionView),
  }
}

function incomingOfferView(offer) {
  const s = load()
  const assessment = byId(s.assessments, offer.assessmentId)
  return {
    ...offerView(offer),
    observee: teacherBrief(assessment.teacherId),
    section: sectionView(assessment.sectionId),
    assessmentStatus: assessment.status,
  }
}

const logView = (row) => ({
  id: row.id,
  assessmentId: row.assessmentId,
  attemptNo: row.attemptNo,
  type: row.type,
  by: { name: row.byName, role: row.byRole },
  at: row.at,
  reason: row.reason,
  observer: row.observerId ? teacherBrief(row.observerId) : null,
  date: row.date,
  count: row.count,
})

function observationView(observation) {
  const s = load()
  const assessment = byId(s.assessments, observation.assessmentId)
  const list = observation.sourceListId && byId(s.candidateLists, observation.sourceListId)
  return {
    id: observation.id,
    assessmentId: observation.assessmentId,
    assessmentStatus: assessment.status,
    attemptNo: observation.attemptNo,
    status: observation.status,
    isAcStepin: observation.isAcStepin,
    sourceListId: observation.sourceListId,
    sourceList: list ? { id: list.id, poolSize: list.poolSize, listSize: list.listSize } : null,
    scheduledDate: observation.scheduledDate,
    observer: teacherBrief(observation.observerId),
    observee: teacherBrief(observation.observeeId),
    section: sectionView(assessment.sectionId),
    observerSignedOffAt: observation.observerSignedOffAt,
    observeeSignedOffAt: observation.observeeSignedOffAt,
    observeeComment: observation.observeeComment,
    retryAfter: observation.retryAfter,
    createdAt: observation.createdAt,
    updatedAt: observation.updatedAt,
  }
}

function assessmentView(assessment) {
  const pairing = activeObservation(assessment.id) ?? latestObservation(assessment.id)
  const list = latestList(assessment.id)
  const offer = pendingOffer(assessment.id)
  return {
    id: assessment.id,
    teacherId: assessment.teacherId,
    sectionId: assessment.sectionId,
    dueTermId: assessment.dueTermId,
    status: assessment.status,
    signedUpAt: assessment.signedUpAt,
    completedAt: assessment.completedAt,
    notes: assessment.notes,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
    teacher: teacherBrief(assessment.teacherId),
    section: sectionView(assessment.sectionId),
    signupDeadline: signupDeadline(assessment),
    selectionOpen: selectionOpen(assessment),
    alert: alertFor(assessment),
    attemptNo: currentAttemptNo(assessment.id),
    pairing: pairing ? observationView(pairing) : null,
    candidateSummary: list ? { poolSize: list.poolSize, listSize: list.listSize } : null,
    offer: offer ? offerView(offer) : null,
  }
}

// GET /assessments/:id and POST /assessments/:id/candidates share this shape.
function assessmentDetail(assessment) {
  const s = load()
  const list = latestList(assessment.id)
  const rows = list
    ? s.candidates.filter((c) => c.listId === list.id).sort((a, b) => a.position - b.position)
    : []
  return {
    ...assessmentView(assessment),
    candidateList: list
      ? {
          id: list.id,
          targetSchool: list.targetSchool,
          targetLevel: list.targetLevel,
          poolSize: list.poolSize,
          listSize: list.listSize,
          generatedAt: list.generatedAt,
        }
      : null,
    candidates: rows.map((candidate) => ({
      ...teacherBrief(candidate.teacherId),
      position: candidate.position,
    })),
    timeOptions: s.timeOptions
      .filter((o) => o.assessmentId === assessment.id)
      .sort((a, b) => a.attemptNo - b.attemptNo || a.proposedDate.localeCompare(b.proposedDate))
      .map(optionView),
    offers: s.offers.filter((o) => o.assessmentId === assessment.id).map(offerView),
    observations: s.observations
      .filter((o) => o.assessmentId === assessment.id)
      .sort((a, b) => a.attemptNo - b.attemptNo)
      .map(observationView),
    attempts: s.attemptLog.filter((row) => row.assessmentId === assessment.id).map(logView),
  }
}

// ----------------------------------------------------------------- rules ----

function requireTeacher(user) {
  if (!user.teacherId) {
    throw fail(403, "forbidden", "This account is not linked to a teacher profile")
  }
  return user.teacherId
}

function getAssessmentFor(user, id, { ownerOrAC = true } = {}) {
  const assessment = byId(load().assessments, id)
  if (!assessment) throw fail(404, "not_found", "Assessment not found")
  if (ownerOrAC && !isAC(user) && assessment.teacherId !== user.teacherId) {
    throw fail(403, "forbidden", "You do not have permission to do that")
  }
  return assessment
}

// An observation date is a real class meeting: today or later, inside the
// term, on a day the section meets.
function checkObservationDate(section, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
    throw fail(400, "validation_error", "Choose a valid observation date.")
  }
  const term = byId(load().terms, section.termId)
  if (date < today()) throw fail(400, "validation_error", "The observation date can't be in the past.")
  if (date < term.startDate || date > term.endDate) {
    throw fail(400, "validation_error", "The date must fall inside the term.")
  }
  if (section.meetingDays) {
    const code = ["U", "M", "T", "W", "R", "F", "S"][new Date(`${date}T12:00:00`).getDay()]
    if (!section.meetingDays.includes(code)) {
      throw fail(400, "validation_error", "The class doesn't meet on that day.")
    }
  }
}

function overlaps(a, b) {
  if (!a.meetingDays || !b.meetingDays || !a.startTime || !b.startTime) return false
  const sharesDay = [...a.meetingDays].some((day) => b.meetingDays.includes(day))
  return sharesDay && a.startTime < b.endTime && b.startTime < a.endTime
}

// Same rules as backend/db/queries/eligible_observers.sql plus the
// availability check from requirements §4.2 (computed from schedules).
// Known gap shared with the backend SQL: §4.2 says the pool should be limited to
// professors who signed up this cycle; this uses the full roster.
function eligibleObservers(assessment) {
  const s = load()
  const target = byId(s.sections, assessment.sectionId)
  const course = byId(s.courses, target.courseId)
  const lookback = new Date()
  lookback.setFullYear(lookback.getFullYear() - APP_SETTINGS.observerLookbackYears)
  const cutoff = isoDay(lookback)

  return s.teachers.filter((teacher) => {
    if (!teacher.isActive || teacher.id === assessment.teacherId) return false
    if (teacher.school !== course.school) return false

    const taughtLevel = s.sections.some((section) => {
      if (section.teacherId !== teacher.id) return false
      const c = byId(s.courses, section.courseId)
      const term = byId(s.terms, section.termId)
      return (
        c.school === course.school &&
        c.courseLevel === course.courseLevel &&
        term.startDate <= today() &&
        term.endDate >= cutoff
      )
    })
    if (!taughtLevel) return false

    const busy = s.sections.some(
      (section) =>
        section.teacherId === teacher.id &&
        section.termId === target.termId &&
        overlaps(section, target),
    )
    return !busy
  })
}

function shuffle(rows) {
  const copy = [...rows]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function touch(row) {
  row.updatedAt = nowISO()
}

// Once a request is answered, expires or is withdrawn its dates are free again,
// so the professor can offer them (or others) to someone else.
function releaseOptions(offer) {
  for (const option of load().timeOptions) {
    if (offer.optionIds.includes(option.id) && !option.isConfirmed) {
      option.offeredToTeacherId = null
    }
  }
}

function closeOffer(offer, status, { reason, by, type }) {
  const s = load()
  offer.status = status
  offer.respondedAt = nowISO()
  offer.reason = reason?.trim() || null
  releaseOptions(offer)
  logAttempt(byId(s.assessments, offer.assessmentId), type, {
    by,
    attemptNo: offer.attemptNo,
    observerId: offer.observerId,
    reason,
  })
}

// A scheduled (confirmed) attempt. There is no review step: the pairing is final
// once the observer confirms a date (or the committee assigns one).
function createObservation(assessment, fields) {
  const s = load()
  const observation = {
    id: s.nextId.observation++,
    assessmentId: assessment.id,
    observeeId: assessment.teacherId,
    observerId: fields.observerId,
    attemptNo: fields.attemptNo ?? currentAttemptNo(assessment.id),
    status: "approved", // backend key kept for compatibility; shown as "Scheduled / Confirmed"
    isAcStepin: fields.isAcStepin,
    sourceListId: fields.sourceListId ?? null,
    scheduledDate: fields.scheduledDate,
    observerSignedOffAt: null,
    observeeSignedOffAt: null,
    observeeComment: null,
    retryAfter: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  s.observations.push(observation)
  assessment.status = "approved"
  touch(assessment)
  return observation
}

function getObservationFor(user, id) {
  const observation = byId(load().observations, id)
  if (!observation) throw fail(404, "not_found", "Observation not found")
  const isParty =
    user.teacherId && [observation.observerId, observation.observeeId].includes(user.teacherId)
  if (!isParty && !isAC(user)) {
    throw fail(403, "forbidden", "You do not have permission to do that")
  }
  return { observation, isParty }
}

function assertNotCompleted(observation) {
  if (observation.status === "completed") {
    throw fail(409, "conflict", "This observation is complete and can no longer be changed.")
  }
}

// Candidate generation: the committee starts it, never the professor.
function generateList(assessment, user) {
  const s = load()
  const pool = eligibleObservers(assessment)
  const picked = shuffle(pool).slice(0, APP_SETTINGS.candidateListSize)
  const target = byId(s.sections, assessment.sectionId)
  const course = byId(s.courses, target.courseId)
  const list = {
    id: s.nextId.candidateList++,
    assessmentId: assessment.id,
    targetLevel: course.courseLevel,
    targetSchool: course.school,
    poolSize: pool.length,
    listSize: picked.length,
    generatedAt: nowISO(),
  }
  s.candidateLists.push(list)
  picked.forEach((teacher, index) =>
    s.candidates.push({ listId: list.id, teacherId: teacher.id, position: index + 1 }),
  )
  // Zero pool: the sign-up stays `signed_up` and the committee is alerted
  // (requirements §4.2). The 0/0 list is kept so the alert and the
  // "unmatched faculty" / "list sufficiency" KPIs can see it.
  if (picked.length > 0) assessment.status = "candidates_generated"
  touch(assessment)
  logAttempt(assessment, "selection_started", { by: actorOf(user) })
  return list
}

function assertSelectionOpen(assessment) {
  if (!selectionOpen(assessment)) {
    throw fail(
      409,
      "conflict",
      `Observer selection opens after the sign-up deadline (${signupDeadline(assessment)}).`,
    )
  }
}

function assertSchedulable(assessment) {
  if (assessment.status === "signed_up") {
    throw fail(409, "conflict", "The committee hasn't started observer selection for this sign-up yet.")
  }
  if (!["candidates_generated", "postponed"].includes(assessment.status)) {
    throw fail(409, "conflict", "This sign-up is no longer open for scheduling.")
  }
}

// ---------------------------------------------------------------- routes ----

const routes = []
const route = (method, pattern, handler) =>
  routes.push({ method, regex: new RegExp(`^${pattern}$`), handler })

// -- auth [backend]
route("POST", "/auth/login", ({ body }) => {
  const email = body?.email?.trim().toLowerCase()
  const user = load().users.find((u) => u.email === email)
  if (!user || body?.password !== DEMO_PASSWORD) {
    throw fail(401, "invalid_credentials", "Invalid email or password")
  }
  return {
    token: tokenFor(user),
    user: { id: user.id, email: user.email, role: user.role, teacherId: user.teacherId },
  }
})

route("GET", "/auth/me", ({ user }) => {
  const teacher = user.teacherId ? byId(load().teachers, user.teacherId) : null
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    teacherId: user.teacherId,
    firstName: teacher?.firstName ?? null,
    lastName: teacher?.lastName ?? null,
  }
})

// -- teachers / terms / courses / sections [backend]
route("GET", "/teachers", ({ user, params }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const q = params.get("q")?.toLowerCase()
  const rows = load().teachers.filter(
    (t) =>
      (!q || `${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(q)) &&
      (!params.get("school") || t.school === params.get("school")) &&
      (!params.get("rank") || t.rank === params.get("rank")) &&
      (!params.get("active") || String(t.isActive) === params.get("active")),
  )
  return paged(rows, params)
})

route("GET", "/teachers/(\\d+)", ({ user, match }) => {
  const teacher = byId(load().teachers, match[1])
  if (!teacher) throw fail(404, "not_found", "Teacher not found")
  if (!isAC(user) && user.teacherId !== teacher.id) {
    throw fail(403, "forbidden", "You do not have permission to do that")
  }
  return teacher
})

// `signupDeadline` is mock-only (the backend terms have no such field).
route("GET", "/terms", () => ({
  data: [...load().terms].sort((a, b) => b.startDate.localeCompare(a.startDate)),
}))

route("GET", "/courses", ({ params }) => {
  const q = params.get("q")?.toLowerCase()
  const rows = load().courses.filter(
    (c) =>
      (!q || `${c.subject} ${c.courseNumber} ${c.title}`.toLowerCase().includes(q)) &&
      (!params.get("subject") || c.subject === params.get("subject")) &&
      (!params.get("school") || c.school === params.get("school")) &&
      (!params.get("level") || c.courseLevel === Number(params.get("level"))),
  )
  return paged(rows, params)
})

route("GET", "/courses/(\\d+)", ({ match }) => {
  const course = byId(load().courses, match[1])
  if (!course) throw fail(404, "not_found", "Course not found")
  return course
})

route("GET", "/sections", ({ params }) => {
  const rows = load()
    .sections.filter(
      (section) =>
        (!params.get("teacherId") || section.teacherId === Number(params.get("teacherId"))) &&
        (!params.get("termId") || section.termId === Number(params.get("termId"))) &&
        (!params.get("level") ||
          byId(load().courses, section.courseId).courseLevel === Number(params.get("level"))),
    )
    .sort((a, b) => b.termId - a.termId || a.courseId - b.courseId)
  return { data: rows.map(flatSection) }
})

// -- assessments (sign-up) [backend]
route("POST", "/assessments/sign-up", ({ user, body }) => {
  const s = load()
  let teacherId = user.teacherId
  if (body?.teacherId && body.teacherId !== teacherId) {
    if (!isAC(user)) {
      throw fail(403, "forbidden", "Only AC/admin can sign up on behalf of another teacher")
    }
    teacherId = body.teacherId
  }
  if (!teacherId) {
    throw fail(400, "validation_error", "No teacher specified and this account has no linked teacher profile")
  }
  const section = byId(s.sections, body?.sectionId)
  if (!section) throw fail(404, "not_found", "Section not found")
  if (section.teacherId !== teacherId) {
    throw fail(409, "conflict", "This teacher is not the instructor of that section")
  }
  const term = byId(s.terms, section.termId)
  // Patched rules (not in the backend yet): only current/upcoming long terms.
  if (term.endDate < today()) {
    throw fail(409, "conflict", "That term has already ended — sign up for a current or upcoming section.")
  }
  if (term.season === "summer") {
    throw fail(409, "conflict", "Summer terms aren't part of the evaluation cycle.")
  }
  if (s.assessments.some((a) => a.sectionId === section.id)) {
    throw fail(409, "conflict", "This section already has an observation sign-up.")
  }
  const assessment = {
    id: s.nextId.assessment++,
    teacherId,
    sectionId: section.id,
    dueTermId: section.termId,
    status: "signed_up",
    signedUpAt: nowISO(),
    completedAt: null,
    notes: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  s.assessments.push(assessment)
  save()
  return assessmentView(assessment)
})

// [new] committee dashboard feed — must be registered before /assessments/:id.
// Alerts: sign-ups whose eligible pool is empty (urgent) or short (limited).
route("GET", "/assessments/alerts", ({ user, params }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const s = load()
  const termId = Number(params.get("termId") ?? 0)
  const scoped = s.assessments.filter((a) => !termId || a.dueTermId === termId)
  const views = scoped.map(assessmentView)
  const rank = { no_eligible_observers: 0, limited_pool: 1 }
  const alerts = views
    .filter((view) => view.alert)
    .sort((a, b) => rank[a.alert] - rank[b.alert] || a.signedUpAt.localeCompare(b.signedUpAt))
  const postponed = views.filter((view) => view.status === "postponed")
  const awaitingSignOff = s.observations
    .filter((o) => o.status === "approved" && scoped.some((a) => a.id === o.assessmentId))
    .map(observationView)
  return {
    data: alerts,
    postponed,
    awaitingSignOff,
    counts: {
      urgent: alerts.filter((view) => view.alert === "no_eligible_observers").length,
      limited: alerts.filter((view) => view.alert === "limited_pool").length,
      waitingToStart: views.filter((view) => view.status === "signed_up" && !view.candidateSummary)
        .length,
      postponed: postponed.length,
      awaitingSignOff: awaitingSignOff.length,
    },
  }
})

// [new] bulk "Start Observer Selection" for a term (or a chosen set of sign-ups).
// The per-sign-up version is the existing POST /assessments/:id/candidates.
route("POST", "/assessments/start-selection", ({ user, body }) => {
  if (!isAC(user)) {
    throw fail(403, "forbidden", "Only the committee can start observer selection.")
  }
  const s = load()
  const ids = body?.assessmentIds
  if (!ids?.length && !body?.termId) {
    throw fail(400, "validation_error", "Choose a term or the sign-ups to start.")
  }
  const targets = s.assessments.filter(
    (a) =>
      a.status === "signed_up" &&
      !latestList(a.id) &&
      (ids?.length ? ids.includes(a.id) : a.dueTermId === Number(body.termId)),
  )
  const ready = targets.filter(selectionOpen)
  const skipped = targets.length - ready.length
  if (ready.length === 0 && skipped > 0) {
    throw fail(
      409,
      "conflict",
      `Observer selection opens after the sign-up deadline (${signupDeadline(targets[0])}).`,
    )
  }
  const lists = ready.map((assessment) => generateList(assessment, user))
  save()
  return {
    started: lists.length,
    noEligible: lists.filter((list) => list.poolSize === 0).length,
    limited: lists.filter(
      (list) => list.poolSize > 0 && list.poolSize < APP_SETTINGS.candidateListSize,
    ).length,
    skipped,
  }
})

route("GET", "/assessments/mine", ({ user }) => {
  const teacherId = requireTeacher(user)
  return {
    data: load()
      .assessments.filter((a) => a.teacherId === teacherId)
      .sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt))
      .map(assessmentView),
  }
})

route("GET", "/assessments", ({ user, params }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const rows = load()
    .assessments.filter(
      (a) =>
        (!params.get("teacherId") || a.teacherId === Number(params.get("teacherId"))) &&
        (!params.get("termId") || a.dueTermId === Number(params.get("termId"))) &&
        (!params.get("status") || a.status === params.get("status")),
    )
    .sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt))
  const result = paged(rows, params)
  return { ...result, data: result.data.map(assessmentView) }
})

route("GET", "/assessments/(\\d+)", ({ user, match }) =>
  assessmentDetail(getAssessmentFor(user, match[1])),
)

// [backend, access tightened in the mock] surface up to 5 observer candidates.
// The real route also lets the owner call it and has no deadline; the committee
// starts this after the sign-up deadline (requirements §4.3 step 2). Calling it
// again returns the same list (no re-rolling) unless nobody qualified last time.
route("POST", "/assessments/(\\d+)/candidates", ({ user, match }) => {
  if (!isAC(user)) {
    throw fail(403, "forbidden", "Only the committee starts observer selection.")
  }
  const assessment = getAssessmentFor(user, match[1])
  if (!["signed_up", "candidates_generated"].includes(assessment.status)) {
    throw fail(409, "conflict", "This sign-up is not open for observer selection.")
  }
  assertSelectionOpen(assessment)
  const existing = latestList(assessment.id)
  if (existing && existing.poolSize > 0) return assessmentDetail(assessment)
  generateList(assessment, user)
  save()
  return assessmentDetail(assessment)
})

// [committee] manual assignment (insufficient pool, or on the professor's behalf).
// TODO(BLOCKED: requirements §4.3 step 6 and §8): must the AC's manual pick come
// from the eligible pool, or may it be any faculty member? Not answered yet, so
// this keeps the existing behaviour (a candidate-list member, or an AC member as
// step-in) and must not be treated as the answer. The real backend currently only
// allows an override when the pool is empty.
route("POST", "/assessments/(\\d+)/observations", ({ user, match, body }) => {
  if (!isAC(user)) {
    throw fail(403, "forbidden", "Only the committee assigns observers directly — pick one from your list instead.")
  }
  const s = load()
  const assessment = getAssessmentFor(user, match[1])
  if (
    !["signed_up", "candidates_generated", "postponed"].includes(assessment.status) ||
    activeObservation(assessment.id)
  ) {
    throw fail(409, "conflict", "This sign-up already has a scheduled observation.")
  }
  const section = byId(s.sections, assessment.sectionId)
  const observer = byId(s.teachers, body?.observerId)
  if (!observer || observer.id === assessment.teacherId) {
    throw fail(400, "validation_error", "Choose a different professor as observer.")
  }
  const isStepin = !body?.candidateListId
  if (isStepin) {
    const isMember = s.users.some((u) => u.role === "ac_member" && u.teacherId === observer.id)
    if (!isMember) throw fail(409, "conflict", "Only an Assessment Committee member can step in as observer.")
  } else {
    const onList = s.candidates.some(
      (c) => c.listId === body.candidateListId && c.teacherId === observer.id,
    )
    if (!onList) throw fail(409, "conflict", "The selected observer is not on the candidate list for this assessment.")
  }
  checkObservationDate(section, body?.scheduledDate)
  const by = actorOf(user)
  const waiting = pendingOffer(assessment.id)
  if (waiting) {
    closeOffer(waiting, "withdrawn", {
      reason: "Replaced by a committee assignment.",
      by,
      type: "request_withdrawn",
    })
  }
  const observation = createObservation(assessment, {
    observerId: observer.id,
    isAcStepin: isStepin,
    sourceListId: body?.candidateListId ?? null,
    scheduledDate: body.scheduledDate,
  })
  logAttempt(assessment, "ac_assigned", {
    by,
    observerId: observer.id,
    date: body.scheduledDate,
    attemptNo: observation.attemptNo,
  })
  save()
  return { observation: observationView(observation), assessment: assessmentView(assessment) }
})

// [new] committee: which committee members could step in as observer?
route("GET", "/assessments/(\\d+)/step-in-options", ({ user, match }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const assessment = getAssessmentFor(user, match[1])
  const s = load()
  const ids = s.users
    .filter((u) => u.role === "ac_member" && u.teacherId && u.teacherId !== assessment.teacherId)
    .map((u) => u.teacherId)
  return { data: ids.map(teacherBrief) }
})

// [new] The attempt did not go ahead: record why and mark the sign-up Postponed.
// Nothing is cancelled or deleted; a new attempt can be scheduled afterwards.
route("POST", "/assessments/(\\d+)/postpone", ({ user, match, body }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const assessment = getAssessmentFor(user, match[1])
  if (!["signed_up", "candidates_generated", "approved"].includes(assessment.status)) {
    throw fail(409, "conflict", "This sign-up can't be postponed.")
  }
  if (!body?.reason?.trim()) {
    throw fail(400, "validation_error", "Say why this is being postponed.")
  }
  const by = actorOf(user)
  const waiting = pendingOffer(assessment.id)
  if (waiting) {
    closeOffer(waiting, "withdrawn", {
      reason: "Sign-up postponed.",
      by,
      type: "request_withdrawn",
    })
  }
  const attemptNo = currentAttemptNo(assessment.id)
  const active = activeObservation(assessment.id)
  if (active) {
    active.status = "postponed"
    touch(active)
  }
  logAttempt(assessment, "postponed", { by, attemptNo, reason: body.reason })
  assessment.status = "postponed"
  touch(assessment)
  save()
  return assessmentView(assessment)
})

// -- dates and requests (backend: routes/assessments.js + routes/timeOptions.js)

// [backend, rules tightened] The professor proposes dates for the NEXT request.
// Backend accepts 1-8 options; requirements §4.3 step 4 say roughly 4-8, which the
// mock enforces. Re-sending a date that is already proposed is a no-op.
route("POST", "/assessments/(\\d+)/time-options", ({ user, match, body }) => {
  const s = load()
  const assessment = getAssessmentFor(user, match[1])
  assertSchedulable(assessment)
  const section = byId(s.sections, assessment.sectionId)
  const incoming = body?.options
  if (!Array.isArray(incoming) || incoming.length < MIN_DATES || incoming.length > MAX_DATES) {
    throw fail(400, "validation_error", `Offer between ${MIN_DATES} and ${MAX_DATES} possible dates.`)
  }
  const attemptNo = currentAttemptNo(assessment.id)
  const saved = []
  for (const item of incoming) {
    checkObservationDate(section, item.proposedDate)
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!hhmm.test(item.startTime ?? "") || !hhmm.test(item.endTime ?? "") || item.endTime <= item.startTime) {
      throw fail(400, "validation_error", "Each date needs a start time before its end time.")
    }
    const same = unsentOptions(assessment.id).find(
      (o) => o.proposedDate === item.proposedDate && o.startTime === item.startTime,
    )
    if (same) {
      saved.push(same)
      continue
    }
    const option = {
      id: s.nextId.timeOption++,
      assessmentId: assessment.id,
      proposedDate: item.proposedDate,
      startTime: item.startTime,
      endTime: item.endTime,
      offeredToTeacherId: null,
      isConfirmed: false,
      attemptNo,
      createdAt: nowISO(),
    }
    s.timeOptions.push(option)
    saved.push(option)
  }
  if (unsentOptions(assessment.id).length > MAX_DATES) {
    throw fail(400, "validation_error", `Offer at most ${MAX_DATES} dates.`)
  }
  save()
  return { data: saved.map(optionView) }
})

route("GET", "/assessments/(\\d+)/time-options", ({ user, match }) => {
  const s = load()
  const assessment = byId(s.assessments, match[1])
  if (!assessment) throw fail(404, "not_found", "Assessment not found")
  const offeredToMe = s.offers.some(
    (o) => o.assessmentId === assessment.id && o.observerId === user.teacherId,
  )
  if (!isAC(user) && assessment.teacherId !== user.teacherId && !offeredToMe) {
    throw fail(403, "forbidden", "You do not have permission to view these time options")
  }
  return {
    data: s.timeOptions
      .filter((o) => o.assessmentId === assessment.id)
      .sort((a, b) => a.attemptNo - b.attemptNo || a.proposedDate.localeCompare(b.proposedDate))
      .map(optionView),
  }
})

// [backend] one request, to ONE observer, carrying all the proposed dates.
// Mock additions: only people on the latest list, a 48h expiry, and the request
// is recorded so declines / no-responses stay on the record.
route("POST", "/assessments/(\\d+)/time-options/send", ({ user, match, body }) => {
  const s = load()
  const assessment = getAssessmentFor(user, match[1])
  assertSchedulable(assessment)
  const waiting = pendingOffer(assessment.id)
  if (waiting) {
    const name = teacherBrief(waiting.observerId)
    throw fail(
      409,
      "conflict",
      `A request is already waiting for ${name.firstName} ${name.lastName}. Withdraw it before asking someone else.`,
    )
  }
  const teacherId = Number(body?.teacherId)
  const list = latestList(assessment.id)
  const listed = list ? s.candidates.filter((c) => c.listId === list.id).map((c) => c.teacherId) : []
  if (!listed.includes(teacherId)) {
    throw fail(409, "conflict", "You can only ask someone from your observer list.")
  }
  const options = unsentOptions(assessment.id)
  if (options.length < MIN_DATES || options.length > MAX_DATES) {
    throw fail(400, "validation_error", `Offer between ${MIN_DATES} and ${MAX_DATES} dates before sending.`)
  }
  const now = Date.now()
  const attemptNo = currentAttemptNo(assessment.id)
  s.offers.push({
    id: s.nextId.offer++,
    assessmentId: assessment.id,
    observerId: teacherId,
    attemptNo,
    status: "pending",
    sentAt: new Date(now).toISOString(),
    expiresAt: new Date(now + APP_SETTINGS.requestExpiryHours * HOUR).toISOString(),
    respondedAt: null,
    reason: null,
    optionIds: options.map((o) => o.id),
  })
  for (const option of options) option.offeredToTeacherId = teacherId
  assessment.status = "candidates_generated" // a postponed sign-up starts a new attempt
  touch(assessment)
  logAttempt(assessment, "request_sent", {
    by: actorOf(user),
    attemptNo,
    observerId: teacherId,
    count: options.length,
  })
  save()
  return { data: options.map(optionView) }
})

// [new] The professor takes the request back (to ask someone else). Logged.
route("POST", "/assessments/(\\d+)/time-options/withdraw", ({ user, match, body }) => {
  const assessment = getAssessmentFor(user, match[1])
  const offer = pendingOffer(assessment.id)
  if (!offer) throw fail(409, "conflict", "There is no request waiting for an answer.")
  closeOffer(offer, "withdrawn", {
    reason: body?.reason,
    by: actorOf(user),
    type: "request_withdrawn",
  })
  save()
  return assessmentView(assessment)
})

// [new] The observer can't do any of the dates. The reason is optional but kept.
route("POST", "/assessments/(\\d+)/time-options/decline", ({ user, match, body }) => {
  const assessment = byId(load().assessments, match[1])
  if (!assessment) throw fail(404, "not_found", "Assessment not found")
  const offer = pendingOffer(assessment.id)
  if (!offer) throw fail(409, "conflict", "This request is no longer open.")
  if (offer.observerId !== user.teacherId) {
    throw fail(403, "forbidden", "This request was sent to someone else.")
  }
  closeOffer(offer, "declined", {
    reason: body?.reason,
    by: actorOf(user),
    type: "request_declined",
  })
  save()
  return incomingOfferView(offer)
})

// [new] The observer's inbox: requests sent to me, newest first (open ones on top).
route("GET", "/time-options/incoming", ({ user }) => {
  const teacherId = requireTeacher(user)
  return {
    data: load()
      .offers.filter((o) => o.observerId === teacherId)
      .sort(
        (a, b) =>
          Number(b.status === "pending") - Number(a.status === "pending") ||
          b.sentAt.localeCompare(a.sentAt),
      )
      .map(incomingOfferView),
  }
})

// [backend, extended] The observer confirms exactly one date. That is the
// pairing: no committee step follows. The real route only flips is_confirmed;
// the mock also records the scheduled attempt (see api-expectations.md).
route("POST", "/time-options/(\\d+)/confirm", ({ user, match }) => {
  const s = load()
  const option = byId(s.timeOptions, match[1])
  if (!option) throw fail(404, "not_found", "Time option not found")
  if (option.offeredToTeacherId !== user.teacherId) {
    throw fail(403, "forbidden", "This option was not offered to you")
  }
  if (option.isConfirmed) throw fail(409, "conflict", "This option is already confirmed")
  const offer = s.offers.find(
    (o) => o.status === "pending" && o.optionIds.includes(option.id) && o.observerId === user.teacherId,
  )
  if (!offer) throw fail(409, "conflict", "This request is no longer open.")
  if (option.proposedDate < today()) {
    throw fail(409, "conflict", "That date has already passed — ask for new dates.")
  }
  const assessment = byId(s.assessments, option.assessmentId)
  option.isConfirmed = true
  for (const sibling of s.timeOptions) {
    if (
      sibling.assessmentId === option.assessmentId &&
      sibling.attemptNo === option.attemptNo &&
      sibling.id !== option.id &&
      !sibling.isConfirmed
    ) {
      sibling.offeredToTeacherId = null
    }
  }
  offer.status = "confirmed"
  offer.respondedAt = nowISO()
  const list = latestList(assessment.id)
  createObservation(assessment, {
    observerId: user.teacherId,
    isAcStepin: false,
    sourceListId: list?.id ?? null,
    scheduledDate: option.proposedDate,
    attemptNo: option.attemptNo,
  })
  logAttempt(assessment, "date_confirmed", {
    by: actorOf(user),
    attemptNo: option.attemptNo,
    observerId: user.teacherId,
    date: option.proposedDate,
  })
  save()
  return optionView(option)
})

// -- observations
// [new] Faculty get the observations they give or receive; the committee gets everything.
route("GET", "/observations", ({ user, params }) => {
  const s = load()
  const status = params.get("status")
  const rows = s.observations
    .filter((o) => isAC(user) || [o.observerId, o.observeeId].includes(user.teacherId))
    .filter((o) => !status || o.status === status)
    .sort((a, b) => b.id - a.id)
  return { data: rows.map(observationView) }
})

route("GET", "/observations/(\\d+)", ({ user, match }) => {
  const { observation } = getObservationFor(user, match[1])
  return {
    ...observationView(observation),
    attempts: load()
      .attemptLog.filter((row) => row.assessmentId === observation.assessmentId)
      .map(logView),
  }
})

// [new] Both observer and observee sign off. Observee sign-off confirms the
// observation happened — not agreement with the ratings.
route("POST", "/observations/(\\d+)/sign-off", ({ user, match, body }) => {
  const s = load()
  const { observation } = getObservationFor(user, match[1])
  assertNotCompleted(observation)
  if (observation.status !== "approved") {
    throw fail(409, "conflict", "This observation isn't scheduled, so there is nothing to sign off.")
  }
  if (observation.scheduledDate > today()) {
    throw fail(409, "conflict", "You can confirm once the observation date has arrived.")
  }
  const isObserver = user.teacherId === observation.observerId
  const isObservee = user.teacherId === observation.observeeId
  if (!isObserver && !isObservee) {
    throw fail(403, "forbidden", "Only the observer and the observee can sign off.")
  }
  const field = isObserver ? "observerSignedOffAt" : "observeeSignedOffAt"
  if (observation[field]) throw fail(409, "conflict", "You've already signed off on this observation.")
  observation[field] = nowISO()
  if (isObservee && body?.comment?.trim()) observation.observeeComment = body.comment.trim()
  if (observation.observerSignedOffAt && observation.observeeSignedOffAt) {
    observation.status = "completed"
    const assessment = byId(s.assessments, observation.assessmentId)
    assessment.status = "completed"
    assessment.completedAt = nowISO()
    touch(assessment)
  }
  touch(observation)
  save()
  return observationView(observation)
})

// [new] The scheduled date can't be kept (illness, conflict, a new date…). The
// attempt is kept and marked Postponed with who/when/why; the professor then
// schedules a new attempt in the same semester. Replaces "reschedule" and
// "it didn't happen"; nothing is overwritten or cancelled.
route("POST", "/observations/(\\d+)/postpone", ({ user, match, body }) => {
  const s = load()
  const { observation } = getObservationFor(user, match[1])
  assertNotCompleted(observation)
  if (observation.status !== "approved") {
    throw fail(409, "conflict", "Only a scheduled observation can be postponed.")
  }
  if (!body?.reason?.trim()) {
    throw fail(400, "validation_error", "Say what happened so the attempt is on the record.")
  }
  const assessment = byId(s.assessments, observation.assessmentId)
  logAttempt(assessment, "did_not_happen", {
    by: actorOf(user),
    attemptNo: observation.attemptNo,
    observerId: observation.observerId,
    date: observation.scheduledDate,
    reason: body.reason,
  })
  observation.status = "postponed"
  assessment.status = "postponed"
  touch(observation)
  touch(assessment)
  save()
  return observationView(observation)
})

// ---------------------------------------------------------------- entry ----

export async function mockRequest(path, { method = "GET", body, token } = {}) {
  await wait()
  load()
  expireOffers()

  const [pathname, search] = path.split("?")
  const params = new URLSearchParams(search)

  let user = null
  if (!(pathname === "/auth/login" && method === "POST")) {
    const account = token ? userFromToken(token) : null
    if (!account) throw fail(401, "unauthorized", "Your session ended. Sign in again.")
    user = { id: account.id, role: account.role, teacherId: account.teacherId, email: account.email }
  }

  for (const candidate of routes) {
    if (candidate.method !== method) continue
    const match = pathname.match(candidate.regex)
    if (match) {
      const result = candidate.handler({ user, params, body, match })
      // Return a copy so page state can't mutate the mock database.
      return JSON.parse(JSON.stringify(result))
    }
  }
  throw fail(404, "not_found", `No route for ${method} ${pathname}`)
}
