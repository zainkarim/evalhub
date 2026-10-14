// In-browser stand-in for the EvalHub REST API, used when VITE_API_URL is not
// set (see api.js). State lives in localStorage so a demo survives reloads and
// switching between accounts in the same browser.
//
// Routes marked [backend] exist in backend/docs/api-contract.md or on main today.
// Routes marked [new] are the ones the frontend needs the backend team to add —
// their shapes are documented in frontend/docs/api-expectations.md.
// Business rules come from docs/requirements.md §4.2–4.3 (corrected 2026-09-30):
//   - the AC does NOT approve anything; one cycle-wide action opens observer
//     selection after the sign-up deadline, and the AC handles insufficient pools
//   - the professor picks ONE observer and offers 4-8 dates; the observer confirms one
//   - an attempt that does not happen is never cancelled: it is logged and Postponed

import { computeDue, defaultReportTerm } from "./dueStatus"
import { courseLabel, formatRank, normalizeStatus } from "./format"
import { APP_SETTINGS, buildSeed, DEMO_PASSWORD } from "./mockData"

const STORE_KEY = "evalhub.mock.state.v4"
const HOUR = 60 * 60 * 1000
const MIN_DATES = 4
const MAX_DATES = 8

// ---------------------------------------------------------------- state ----

let state = null

function load() {
  if (state) return state
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null")
    if (saved?.version === 4) {
      state = saved
      state.notifications ??= []
      state.nextId ??= {}

      if (!state.criteria || !state.observationResponses) {
        const seed = buildSeed()
        state.criteria ??= seed.criteria
        state.observationResponses ??= []
        state.nextId.criterion ??= seed.nextId.criterion
        state.nextId.response ??= seed.nextId.response
      }

      state.nextId.notification ??=
        Math.max(0, ...state.notifications.map((item) => item.id)) + 1

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
// In-app notifications (#62). The real backend has no notifications API yet;
// the shape here is the proposed contract in docs/api-expectations.md.
// `observationId` is set once an observation record exists, so the bell can
// open that record directly; otherwise the link goes to the sign-up.
function addNotification(teacherId, type, assessmentId, message, observationId = null) {
  const s = load()
  if (!teacherId || !s.users.some((user) => user.teacherId === teacherId)) return

  const assessment = s.assessments.find((item) => item.id === assessmentId)

  s.notifications.push({
    id: s.nextId.notification++,
    recipientTeacherId: teacherId,
    type,
    termId: assessment?.dueTermId ?? null,
    assessmentId,
    observationId,
    subject: {
      scheduled: "Observation scheduled",
      postponed: "Observation postponed",
      request_sent: "New observation request",
      request_withdrawn: "Observation request withdrawn",
      request_declined: "Observation request declined",
      date_confirmed: "Observation date confirmed",
    }[type] ?? "Observation update",
    body: message,
    link: observationId
      ? `/records/${observationId}`
      : type === "request_sent" || type === "request_withdrawn"
        ? "/observations"
        : `/assessments/${assessmentId}`,
    createdAt: nowISO(),
    readAt: null,
    sentByName: "System",
  })
}

// "CS 1337 · Section 001" for notification messages.
function courseText(assessment) {
  const section = sectionView(assessment.sectionId)
  return `${section.course.subject} ${section.course.courseNumber} · Section ${section.sectionNumber}`
}
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
// "Today" for every date rule in the mock. Tests pin it (setMockToday) so they do not
// depend on when they run; the app never does.
let todayOverride = null
export const setMockToday = (day) => {
  todayOverride = day
}
const today = () => todayOverride ?? isoDay(new Date())
// Sections taught on or after this day count towards observer eligibility and the
// Professors profile; one date so the two cannot disagree.
function lookbackCutoff() {
  const lookback = new Date(`${today()}T12:00:00`)
  lookback.setFullYear(lookback.getFullYear() - APP_SETTINGS.observerLookbackYears)
  return isoDay(lookback)
}
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

// Only a scheduled (confirmed) attempt is "active".
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

// Cycle dates are mock-only. Observer selection is one action for the whole term
// and opens the day after the sign-up deadline.
const termOf = (assessment) => byId(load().terms, assessment.dueTermId)
const signupDeadline = (assessment) => termOf(assessment)?.signupDeadline ?? null
const selectionOpenFor = (term) => !term.signupDeadline || today() > term.signupDeadline

// §4.2: zero eligible is urgent; fewer than a full list is a "limited pool"
// notice. Only meaningful once the committee has generated a list, and it
// clears as soon as an attempt is scheduled.
function alertFor(assessment, list) {
  if (!["signed_up", "candidates_generated"].includes(assessment.status)) return null
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

// Lookups for the assessment views, built once per request so a list of rows
// does not rescan the lists, candidates and notifications for every row.
function viewLookups() {
  const s = load()
  const lists = new Map()
  for (const list of s.candidateLists) {
    const seen = lists.get(list.assessmentId)
    if (!seen || list.id > seen.id) lists.set(list.assessmentId, list)
  }
  const candidates = new Map()
  for (const c of s.candidates) {
    if (!candidates.has(c.listId)) candidates.set(c.listId, [])
    candidates.get(c.listId).push(c)
  }
  const notified = new Map() // assessmentId -> when the first "list is ready" message went out
  for (const n of s.notifications) {
    if (n.type === "list_ready" && !notified.has(n.assessmentId)) notified.set(n.assessmentId, n.createdAt)
  }
  return { lists, candidates, notified }
}

// The up-to-five observers on a list, in list order.
const listedTeachers = (listId, lookups) =>
  (lookups.candidates.get(listId) ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => teacherBrief(c.teacherId))

function assessmentView(assessment, lookups = viewLookups()) {
  const pairing = activeObservation(assessment.id) ?? latestObservation(assessment.id)
  const list = lookups.lists.get(assessment.id) ?? null
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
    selectionStartedAt: termOf(assessment)?.selectionStartedAt ?? null,
    alert: alertFor(assessment, list),
    attemptNo: currentAttemptNo(assessment.id),
    pairing: pairing ? observationView(pairing) : null,
    candidateSummary: list ? { poolSize: list.poolSize, listSize: list.listSize } : null,
    observerList: list ? listedTeachers(list.id, lookups) : [],
    listReadyNotifiedAt: lookups.notified.get(assessment.id) ?? null,
    offer: offer ? offerView(offer) : null,
  }
}

const assessmentViews = (assessments) => {
  const lookups = viewLookups()
  return assessments.map((assessment) => assessmentView(assessment, lookups))
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
  // Older saved demo data has no deadline; then the term end date is the limit.
  if (term?.observationDeadline && date > String(term.observationDeadline).slice(0, 10)) {
    throw fail(400, "validation_error", "The selected date is after the semester observation deadline.")
  }

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
  const cutoff = lookbackCutoff()

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

// A scheduled (confirmed) attempt. The pairing is final
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

const courseLabelOf = (assessment) => {
  const section = byId(load().sections, assessment.sectionId)
  return section ? courseLabel(sectionView(section.id).course) : "your course"
}

function pushNotification(assessment, type, subject, body, sentByName) {
  const s = load()
  s.notifications.push({
    id: s.nextId.notification++,
    recipientTeacherId: assessment.teacherId,
    type,
    termId: assessment.dueTermId,
    assessmentId: assessment.id,
    subject,
    body,
    link: `/assessments/${assessment.id}`,
    createdAt: nowISO(),
    readAt: null,
    sentByName,
  })
}

const listBody = (assessment, list) =>
  `Your list of ${list.listSize} possible observer${list.listSize === 1 ? "" : "s"} for ${courseLabelOf(assessment)} is ready. Choose one observer, offer 4–8 dates and send the request yourself.`

// Builds one sign-up's list (up to five observers). Only runs as part of the
// cycle-wide Start Observer Selection (or its re-check), or when the committee
// signs someone up after selection has started. A non-empty list sends the
// professor its one "list is ready" message right here, so every route to a
// list produces it; an empty list sends nothing.
function generateList(assessment) {
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
  if (picked.length > 0) {
    assessment.status = "candidates_generated"
  }
  touch(assessment)
  logAttempt(assessment, "list_generated", { by: { name: "System", role: "system" } })
  if (picked.length > 0) {
    pushNotification(assessment, "list_ready", "Your observer list is ready", listBody(assessment, list), "System")
  }
  return list
}

function assertSchedulable(assessment) {
  if (assessment.status === "signed_up") {
    throw fail(409, "conflict", "There is no observer list for this sign-up yet, so there is nobody to choose from.")
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

// -- AC Professors page (requirements §4.11, issue #63) [new]
// Register BEFORE "/teachers/:id" on the real backend, or Express reads "report" as an id.
const SIGNUP_PRIORITY = { completed: 5, approved: 4, candidates_generated: 3, signed_up: 2, postponed: 1 }

const sectionTerm = (sectionId) => byId(load().terms, byId(load().sections, sectionId).termId)
const courseOfSection = (sectionId) => byId(load().courses, byId(load().sections, sectionId).courseId)

function reportTerm(params) {
  const s = load()
  const termId = params.get("termId")
  const term = termId ? byId(s.terms, termId) : defaultReportTerm(s.terms, today())
  if (!term) throw fail(404, "not_found", "Term not found")
  return term
}

// The professor's completed observations as observee, each with the semester it was held in
// (the section's term, not the sign-off date).
function completedAsObservee(teacherId) {
  return load()
    .observations.filter((o) => o.observeeId === teacherId && o.status === "completed")
    .map((o) => ({ observation: o, term: sectionTerm(byId(load().assessments, o.assessmentId).sectionId) }))
    .sort((a, b) => a.observation.scheduledDate.localeCompare(b.observation.scheduledDate))
}

// The sign-up that stands for this professor in the term (the furthest along if several).
function termSignUp(teacherId, term) {
  return (
    load()
      .assessments.filter(
        (a) => a.teacherId === teacherId && a.dueTermId === term.id && a.status !== "not_eligible",
      )
      .sort((a, b) => (SIGNUP_PRIORITY[b.status] ?? 0) - (SIGNUP_PRIORITY[a.status] ?? 0))[0] ?? null
  )
}

function currentStatusOf(assessment) {
  if (!assessment) return { currentStatus: "none", currentDate: null, attempts: 0 }
  const status = normalizeStatus(assessment.status)
  if (status === "completed") {
    const done = load()
      .observations.filter((o) => o.assessmentId === assessment.id && o.status === "completed")
      .map((o) => o.scheduledDate)
      .sort()
      .at(-1)
    return { currentStatus: "completed", currentDate: done ?? null, attempts: 0 }
  }
  if (status === "approved") {
    return { currentStatus: "scheduled", currentDate: activeObservation(assessment.id)?.scheduledDate ?? null, attempts: 0 }
  }
  // A postponed sign-up that has sent a new request is waiting on that request again.
  if (pendingOffer(assessment.id)) return { currentStatus: "request_sent", currentDate: null, attempts: 0 }
  if (status === "postponed") {
    return { currentStatus: "postponed", currentDate: null, attempts: Math.max(currentAttemptNo(assessment.id) - 1, 1) }
  }
  return { currentStatus: "selecting_observer", currentDate: null, attempts: 0 }
}

const termBrief = (term) => ({ id: term.id, season: term.season, year: term.year })

function reportRow(teacher, term) {
  // Due status looks at observations finished BEFORE the term starts, so a professor
  // observed this term still shows why they were due; their current status says Completed.
  const history = completedAsObservee(teacher.id)
  const baseline = history.filter((item) => item.term.startDate < term.startDate)
  const last = baseline.at(-1)
  const lastShown = history.filter((item) => item.term.startDate <= term.endDate).at(-1)
  const due = computeDue({ rank: teacher.rank, lastObservedTerm: last?.term ?? null, term })
  const signUpRow = termSignUp(teacher.id, term)
  return {
    id: teacher.id,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    email: teacher.email,
    school: teacher.school,
    department: teacher.department ?? teacher.school,
    isActive: teacher.isActive,
    rank: teacher.rank,
    rankLabel: formatRank(teacher.rank),
    dueStatus: due.status,
    dueTerm: due.dueTerm,
    dueWindow: due.dueWindow,
    lastCompleted: lastShown
      ? { observationId: lastShown.observation.id, date: lastShown.observation.scheduledDate, term: termBrief(lastShown.term) }
      : null,
    ...currentStatusOf(signUpRow),
    signUp: signUpRow
      ? {
          assessmentId: signUpRow.id,
          course: courseLabel(courseOfSection(signUpRow.sectionId)),
          section: byId(load().sections, signUpRow.sectionId).sectionNumber,
        }
      : null,
  }
}

// GET /teachers/report?termId=  (AC / admin) -> every professor, signed up or not, each with
// `isActive`. The page shows active ones by default (§4.11); inactive ones stay in the
// rows so the AC can find and reactivate them, but the counts only cover active professors.
route("GET", "/teachers/report", ({ user, params }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const term = reportTerm(params)
  const data = load()
    .teachers.map((teacher) => reportRow(teacher, term))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
  const active = data.filter((row) => row.isActive)
  const count = (test) => active.filter(test).length
  return {
    term: termBrief(term),
    counts: {
      // `due` includes professors never observed; `neverObserved` says how many of them.
      due: count((row) => row.dueStatus === "due" || row.dueStatus === "never_observed"),
      overdue: count((row) => row.dueStatus === "overdue"),
      neverObserved: count((row) => row.dueStatus === "never_observed"),
      signedUp: count((row) => row.signUp),
      notSignedUp: count((row) => !row.signUp),
      completed: count((row) => row.currentStatus === "completed"),
    },
    data,
  }
})

// GET /teachers/:id/profile?termId=  (AC / admin) -> what the committee needs to pick candidates.
route("GET", "/teachers/(\\d+)/profile", ({ user, match, params }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const s = load()
  const teacher = byId(s.teachers, match[1])
  if (!teacher) throw fail(404, "not_found", "Teacher not found")
  const term = reportTerm(params)

  const cutoff = lookbackCutoff()
  const courses = s.sections
    .filter((section) => section.teacherId === teacher.id)
    .map((section) => ({ section, taughtIn: byId(s.terms, section.termId) }))
    .filter(({ taughtIn }) => taughtIn.id === term.id || (taughtIn.startDate <= today() && taughtIn.endDate >= cutoff))
    .sort((a, b) => b.taughtIn.startDate.localeCompare(a.taughtIn.startDate))
    .map(({ section, taughtIn }) => {
      const course = byId(s.courses, section.courseId)
      return {
        sectionId: section.id,
        sectionNumber: section.sectionNumber,
        term: termBrief(taughtIn),
        thisTerm: taughtIn.id === term.id,
        course: courseLabel(course),
        title: course.title,
        level: course.courseLevel,
        department: course.subject,
        school: course.school,
      }
    })

  const observations = s.observations
    .filter((o) => o.observerId === teacher.id || o.observeeId === teacher.id)
    .map((o) => {
      const assessment = byId(s.assessments, o.assessmentId)
      const given = o.observerId === teacher.id
      return {
        id: o.id,
        assessmentId: o.assessmentId,
        role: given ? "observer" : "observee",
        date: o.scheduledDate,
        status: o.status,
        partner: teacherBrief(given ? o.observeeId : o.observerId),
        course: courseLabel(courseOfSection(assessment.sectionId)),
        term: termBrief(sectionTerm(assessment.sectionId)),
      }
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))

  // Requirements §4.2: an observer takes at most 3 observations per cycle. Postponed
  // attempts are not counted.
  const observerCount = observations.filter(
    (o) => o.role === "observer" && o.term.id === term.id && o.status !== "postponed",
  ).length

  const signUpRow = termSignUp(teacher.id, term)
  return {
    teacher: { ...teacherBrief(teacher.id), department: teacher.department ?? teacher.school, isActive: teacher.isActive },
    term: termBrief(term),
    summary: reportRow(teacher, term),
    courses,
    observations,
    observerLoad: { count: observerCount, cap: APP_SETTINGS.observerCap },
    signUp: signUpRow
      ? {
          assessmentId: signUpRow.id,
          status: signUpRow.status,
          section: sectionView(signUpRow.sectionId),
          attempts: s.attemptLog.filter((row) => row.assessmentId === signUpRow.id).map(logView),
        }
      : null,
  }
})

route("GET", "/teachers/(\\d+)", ({ user, match }) => {
  const teacher = byId(load().teachers, match[1])
  if (!teacher) throw fail(404, "not_found", "Teacher not found")
  if (!isAC(user) && user.teacherId !== teacher.id) {
    throw fail(403, "forbidden", "You do not have permission to do that")
  }
  return teacher
})

route("POST", "/teachers", ({ user, body }) => {
  if (!isAC(user)) {
    throw fail(403, "forbidden", "Access denied")
  }

  const s = load()
  const teacher = {
    ...body,
    // The real column is NOT NULL (migration 005) but the Add Professor form does not
    // send it yet, so fall back to the school code like the migration's own backfill.
    department: body.department || body.school,
    id: Math.max(...s.teachers.map((teacher) => teacher.id), 0) + 1,
  }

  s.teachers.push(teacher)
  save()
  return teacher
})

route("PATCH", "/teachers/(\\d+)", ({ user, match, body }) => {
  if (!isAC(user)) {
    throw fail(403, "forbidden", "Access denied")
  }

  const s = load()
  const teacher = byId(s.teachers, match[1])

  if (!teacher) {
    throw fail(404, "not_found", "Profesor not found")
  }

  // The edit form sends the school but no department, so a school change would leave the
  // old department behind; fall back to the new school like POST does.
  const schoolChanged = body.school && body.school !== teacher.school
  Object.assign(teacher, body)
  if (schoolChanged && !body.department) teacher.department = body.school
  teacher.id = Number(match[1])

  save()
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
  // Faculty sign-ups close with the configured deadline (the deadline day itself
  // is still open). The committee can sign someone up afterwards; once selection
  // has started that sign-up gets its list at once.
  if (term.signupDeadline && today() > term.signupDeadline && !isAC(user)) {
    throw fail(
      409,
      "conflict",
      `Sign-ups closed on ${term.signupDeadline}. Ask the committee to sign you up.`,
    )
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
  if (term.selectionStartedAt) generateList(assessment)
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
  const views = assessmentViews(scoped)
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
      postponed: postponed.length,
      awaitingSignOff: awaitingSignOff.length,
    },
  }
})

// [new] THE one cycle-wide "Start Observer Selection" (process doc: after the
// sign-up deadline the AC clicks one button). Builds the list for every sign-up
// in the term that has none. Idempotent: a second click never re-rolls a
// non-empty list and sends nothing twice. A sign-up whose list is EMPTY is
// re-evaluated on every click ("Re-check empty lists"): if an observer has become
// eligible, its list is generated and the "list is ready" message goes out.
// Not an approval of anything.
route("POST", "/terms/(\\d+)/start-observer-selection", ({ user, match }) => {
  if (!isAC(user)) {
    throw fail(403, "forbidden", "Only the committee can start observer selection.")
  }
  const s = load()
  const term = byId(s.terms, match[1])
  if (!term) throw fail(404, "not_found", "Term not found")
  const alreadyStarted = Boolean(term.selectionStartedAt)
  if (!alreadyStarted && !selectionOpenFor(term)) {
    throw fail(
      409,
      "conflict",
      `Observer selection opens the day after the sign-up deadline (${term.signupDeadline}).`,
    )
  }
  const lists = []
  let stillEmpty = 0
  for (const assessment of s.assessments) {
    if (assessment.dueTermId !== term.id || assessment.status !== "signed_up") continue
    const existing = latestList(assessment.id)
    if (existing && existing.listSize > 0) continue
    // Empty list: only replace it when somebody is eligible now.
    if (existing && eligibleObservers(assessment).length === 0) {
      stillEmpty += 1
      continue
    }
    lists.push(generateList(assessment))
  }
  term.selectionStartedAt ??= nowISO()
  save()
  return {
    termId: term.id,
    alreadyStarted,
    startedAt: term.selectionStartedAt,
    started: lists.length,
    noEligible: lists.filter((list) => list.poolSize === 0).length,
    limited: lists.filter(
      (list) => list.poolSize > 0 && list.poolSize < APP_SETTINGS.candidateListSize,
    ).length,
    full: lists.filter((list) => list.poolSize >= APP_SETTINGS.candidateListSize).length,
    stillEmpty,
  }
})

// [new] The committee edits the cycle dates. In order: sign-up, then the
// observation period, then the feedback/survey deadline.
route("PATCH", "/terms/(\\d+)/dates", ({ user, match, body }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const term = byId(load().terms, match[1])
  if (!term) throw fail(404, "not_found", "Term not found")
  const next = {
    signupDeadline: body?.signupDeadline ?? term.signupDeadline,
    observationDeadline: body?.observationDeadline ?? term.observationDeadline,
    feedbackDeadline: body?.feedbackDeadline ?? term.feedbackDeadline,
  }
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
  if (!Object.values(next).every(isDate)) {
    throw fail(400, "validation_error", "Enter all three dates.")
  }
  if (next.signupDeadline >= next.observationDeadline || next.observationDeadline >= next.feedbackDeadline) {
    throw fail(
      400,
      "validation_error",
      "The dates must run in order: sign-up deadline, observation-period deadline, feedback deadline.",
    )
  }
  if (term.selectionStartedAt && next.signupDeadline !== term.signupDeadline) {
    throw fail(409, "conflict", "Observer selection has already started, so the sign-up deadline can't change.")
  }
  Object.assign(term, next)
  save()
  return term
})

route("GET", "/assessments/mine", ({ user }) => {
  const teacherId = requireTeacher(user)
  return {
    data: assessmentViews(
      load()
        .assessments.filter((a) => a.teacherId === teacherId)
        .sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt)),
    ),
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
  return { ...result, data: assessmentViews(result.data) }
})

route("GET", "/assessments/(\\d+)", ({ user, match }) =>
  assessmentDetail(getAssessmentFor(user, match[1])),
)

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
  addNotification(assessment.teacherId, "scheduled", assessment.id, `The committee scheduled your observation for ${courseText(assessment)} on ${body.scheduledDate}.`, observation.id)
  addNotification(observer.id, "scheduled", assessment.id, `You were assigned to observe ${courseText(assessment)} on ${body.scheduledDate}.`, observation.id)
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
  addNotification(assessment.teacherId, "postponed", assessment.id, `Your observation for ${courseText(assessment)} was postponed. A new attempt can be scheduled.`, active?.id ?? null)
  if (active) {
    addNotification(active.observerId, "postponed", assessment.id, `The observation you were giving for ${courseText(assessment)} was postponed.`, active.id)
  }
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
  addNotification(teacherId, "request_sent", assessment.id, `New observation request for ${courseText(assessment)}. Confirm one of the dates or decline within 48 hours.`)
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
  addNotification(offer.observerId, "request_withdrawn", assessment.id, `The observation request for ${courseText(assessment)} was withdrawn. No action is needed.`)
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
  addNotification(assessment.teacherId, "request_declined", assessment.id, `Your observation request for ${courseText(assessment)} was declined. You can ask another observer.`)
  save()
  return incomingOfferView(offer)
})
// -- evaluation criteria (#33). Mirrors backend/src/routes/criteria.js on main.
const criterionView = (c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  weight: Number(c.weight),
  maxScore: c.maxScore,
  sortOrder: c.sortOrder,
  isActive: c.isActive,
  updatedBy: c.updatedBy,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
})

function requireCommittee(user) {
  if (!isAC(user)) throw fail(403, "forbidden", "Only the committee can change the evaluation criteria.")
}

// Same limits as main's zod schema; `partial` for PATCH.
function cleanCriterion(body, { partial = false } = {}) {
  const out = {}
  if (body?.name !== undefined || !partial) {
    const name = String(body?.name ?? "").trim()
    if (!name || name.length > 200) throw fail(400, "validation_error", "Give the criterion a name (up to 200 characters).")
    out.name = name
  }
  if (body?.description !== undefined) {
    const text = body.description === null ? null : String(body.description).trim()
    if (text && text.length > 2000) throw fail(400, "validation_error", "Keep the description under 2000 characters.")
    out.description = text || null
  }
  if (body?.weight !== undefined) {
    if (typeof body.weight !== "number" || !(body.weight >= 0)) throw fail(400, "validation_error", "Weight must be 0 or more.")
    out.weight = body.weight
  }
  if (body?.maxScore !== undefined) {
    if (!Number.isInteger(body.maxScore) || body.maxScore < 1) throw fail(400, "validation_error", "The rating scale must be a whole number of 1 or more.")
    out.maxScore = body.maxScore
  }
  if (body?.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) throw fail(400, "validation_error", "Sort order must be a whole number.")
    out.sortOrder = body.sortOrder
  }
  if (body?.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") throw fail(400, "validation_error", "isActive must be true or false.")
    out.isActive = body.isActive
  }
  if (partial && Object.keys(out).length === 0) throw fail(400, "validation_error", "Provide at least one field to update")
  return out
}

function assertUniqueName(name, exceptId) {
  const clash = load().criteria.some(
    (c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase(),
  )
  if (clash) throw fail(409, "conflict", `A criterion named "${name}" already exists.`)
}

const sortCriteria = (a, b) => a.sortOrder - b.sortOrder || a.id - b.id

route("GET", "/criteria", ({ params }) => {
  const includeInactive = params.get("includeInactive") === "true"
  return {
    data: load()
      .criteria.filter((c) => includeInactive || c.isActive)
      .sort(sortCriteria)
      .map(criterionView),
  }
})

route("GET", "/criteria/(\\d+)", ({ match }) => {
  const criterion = byId(load().criteria, match[1])
  if (!criterion) throw fail(404, "not_found", "Criterion not found")
  return criterionView(criterion)
})

route("POST", "/criteria", ({ user, body }) => {
  requireCommittee(user)
  const s = load()
  const fields = cleanCriterion(body)
  assertUniqueName(fields.name)
  const criterion = {
    id: s.nextId.criterion++,
    description: null,
    weight: 1,
    maxScore: 5,
    sortOrder: 0,
    isActive: true,
    ...fields,
    updatedBy: user.id,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  s.criteria.push(criterion)
  save()
  return criterionView(criterion)
})

route("PATCH", "/criteria/(\\d+)", ({ user, match, body }) => {
  requireCommittee(user)
  const criterion = byId(load().criteria, match[1])
  if (!criterion) throw fail(404, "not_found", "Criterion not found")
  const fields = cleanCriterion(body, { partial: true })
  if (fields.name) assertUniqueName(fields.name, criterion.id)
  Object.assign(criterion, fields, { updatedBy: user.id, updatedAt: nowISO() })
  save()
  return criterionView(criterion)
})

// Like main: a criterion that any observation has answered can't be deleted
// (409); retire it with isActive:false instead.
route("DELETE", "/criteria/(\\d+)", ({ user, match }) => {
  requireCommittee(user)
  const s = load()
  const criterion = byId(s.criteria, match[1])
  if (!criterion) throw fail(404, "not_found", "Criterion not found")
  if (s.observationResponses.some((r) => r.criterionId === criterion.id)) {
    throw fail(409, "conflict", "This question has already been answered in an observation, so it can't be deleted. Take it off the form instead.")
  }
  s.criteria = s.criteria.filter((c) => c.id !== criterion.id)
  save()
  return null
})

// -- observation form answers (#33). Mirrors main's /observations/:id/responses.
// `notes` is a proposed addition (main has no column for it yet).
route("POST", "/observations/(\\d+)/responses", ({ user, match, body }) => {
  const s = load()
  const observation = byId(s.observations, match[1])
  if (!observation) throw fail(404, "not_found", "Observation not found")
  if (user.teacherId !== observation.observerId) {
    throw fail(403, "forbidden", "Only the observer on this observation can submit responses")
  }
  if (observation.observerSignedOffAt) {
    throw fail(409, "conflict", "You have already signed off on this observation; responses are final")
  }
  const items = body?.responses
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    throw fail(400, "validation_error", "Answer at least one question.")
  }
  const saved = []
  for (const item of items) {
    const criterion = byId(s.criteria, item?.criterionId)
    if (!criterion) throw fail(400, "validation_error", "One of the questions no longer exists. Reload the page.")
    if (!Number.isInteger(item.score) || item.score < 1 || item.score > criterion.maxScore) {
      throw fail(400, "validation_error", `Score for "${criterion.name}" must be between 1 and ${criterion.maxScore}.`)
    }
    let row = s.observationResponses.find(
      (r) => r.observationId === observation.id && r.criterionId === criterion.id,
    )
    if (row) {
      row.score = item.score
      row.updatedAt = nowISO()
    } else {
      row = {
        id: s.nextId.response++,
        observationId: observation.id,
        criterionId: criterion.id,
        score: item.score,
        updatedAt: nowISO(),
      }
      s.observationResponses.push(row)
    }
    saved.push(row)
  }
  if (typeof body?.notes === "string") observation.observerNotes = body.notes.trim() || null
  touch(observation)
  save()
  return { data: saved }
})

// Observer and observee see the answers only once BOTH have signed off; the
// committee can always see them (same rule as main).
route("GET", "/observations/(\\d+)/responses", ({ user, match }) => {
  const s = load()
  const { observation } = getObservationFor(user, match[1])
  const bothSigned = observation.observerSignedOffAt && observation.observeeSignedOffAt
  if (!isAC(user) && !bothSigned) {
    throw fail(409, "conflict", "Responses are not visible until both the observer and observee have signed off")
  }
  const rows = s.observationResponses
    .filter((r) => r.observationId === observation.id)
    .map((r) => ({ r, c: byId(s.criteria, r.criterionId) }))
    .sort((a, b) => sortCriteria(a.c, b.c))
  return {
    data: rows.map(({ r, c }) => ({ ...r, criterionName: c.name, maxScore: c.maxScore })),
    notes: observation.observerNotes ?? null,
  }
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
  const observation = createObservation(assessment, {
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
  addNotification(assessment.teacherId, "date_confirmed", assessment.id, `Your observer confirmed ${option.proposedDate} for ${courseText(assessment)}.`, observation.id)
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
  if (isObserver) {
    // Same rule as main: the observer's sign-off can't lock in a half-filled form.
    const unanswered = s.criteria.filter(
      (c) =>
        c.isActive &&
        !s.observationResponses.some((r) => r.observationId === observation.id && r.criterionId === c.id),
    )
    if (unanswered.length > 0) {
      throw fail(
        409,
        "conflict",
        `Save the observation form before signing off. Unanswered: ${unanswered.map((c) => c.name).join(", ")}.`,
      )
    }
  }
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
  addNotification(observation.observerId, "postponed", assessment.id, `The observation of ${courseText(assessment)} on ${observation.scheduledDate} was postponed.`, observation.id)
  addNotification(observation.observeeId, "postponed", assessment.id, `Your observation for ${courseText(assessment)} on ${observation.scheduledDate} was postponed. A new attempt can be scheduled.`, observation.id)
  save()
  return observationView(observation)
})

// -- notifications [new, mock-only]. In-app messages only; email is not implemented.
// A notification is just a message: nothing in the workflow waits for one.
const notificationView = (n) => ({
  id: n.id,
  type: n.type,
  termId: n.termId,
  subject: n.subject,
  body: n.body,
  link: n.link,
  createdAt: n.createdAt,
  readAt: n.readAt,
  sentBy: { name: n.sentByName },
  channel: "in_app",
})

route("GET", "/notifications/inbox", ({ user }) => {
  const teacherId = requireTeacher(user)
  const rows = load()
    .notifications.filter((n) => n.recipientTeacherId === teacherId)
    .sort((a, b) => b.id - a.id)
  return { data: rows.map(notificationView), unread: rows.filter((n) => !n.readAt).length }
})

route("POST", "/notifications/read-all", ({ user }) => {
  const teacherId = requireTeacher(user)
  for (const n of load().notifications) {
    if (n.recipientTeacherId === teacherId && !n.readAt) n.readAt = nowISO()
  }
  save()
  return { unread: 0 }
})

route("POST", "/notifications/(\\d+)/read", ({ user, match }) => {
  const teacherId = requireTeacher(user)
  const n = byId(load().notifications, match[1])
  if (!n || n.recipientTeacherId !== teacherId) throw fail(404, "not_found", "Notification not found")
  n.readAt ??= nowISO()
  save()
  return notificationView(n)
})

// The committee's Remind / Remind all. The first "list is ready" message is
// sent automatically when a list is generated; this only nudges sign-ups that
// are still choosing an observer (status candidates_generated, non-empty list).
// Approved, completed and postponed sign-ups are never reminded. Nothing waits
// for it.
route("POST", "/notifications/list-reminder", ({ user, body }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const s = load()
  const term = byId(s.terms, body?.termId)
  if (!term) throw fail(400, "validation_error", "Choose a term.")
  if (!term.selectionStartedAt) {
    throw fail(409, "conflict", "Start Observer Selection first; there are no lists to remind anyone about yet.")
  }
  const ids = body?.assessmentIds
  const targets = s.assessments.filter(
    (a) => a.dueTermId === term.id && (!ids?.length || ids.includes(a.id)),
  )
  const by = actorOf(user)
  let sent = 0
  let skipped = 0
  for (const assessment of targets) {
    const list = latestList(assessment.id)
    if (assessment.status !== "candidates_generated" || !list || list.listSize === 0) {
      skipped += 1
      continue
    }
    pushNotification(
      assessment,
      "list_reminder",
      "Reminder: choose your observer",
      `${listBody(assessment, list)} This is a reminder from the committee.`,
      by.name,
    )
    sent += 1
  }
  save()
  return { sent, skipped }
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
