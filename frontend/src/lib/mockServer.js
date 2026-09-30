// In-browser stand-in for the EvalHub REST API, used when VITE_API_URL is not
// set (see api.js). State lives in localStorage so a demo survives reloads and
// switching between accounts in the same browser.
//
// Routes marked [backend] exist in backend/docs/api-contract.md today.
// Routes marked [new] are the ones the frontend needs the backend team to add —
// their shapes are documented in frontend/docs/api-expectations.md.
// Business rules come from docs/requirements.md §4.2–4.3.

import { APP_SETTINGS, buildSeed, DEMO_PASSWORD } from "./mockData"

const STORE_KEY = "evalhub.mock.state.v1"
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// ---------------------------------------------------------------- state ----

let state = null

function load() {
  if (state) return state
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null")
    if (saved?.version === 1) {
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

// Requests that ran past their 48h window become `expired` the next time
// anyone talks to the API (the real backend would do this lazily or on a timer).
function expireRequests() {
  const s = load()
  const now = Date.now()
  let changed = false
  for (const request of s.requests) {
    if (request.status === "pending" && new Date(request.expiresAt).getTime() <= now) {
      request.status = "expired"
      changed = true
    }
  }
  if (changed) save()
}

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

const ACTIVE_OBSERVATION = ["proposed", "approved"]

const activeObservation = (assessmentId) =>
  load().observations.find(
    (o) => o.assessmentId === assessmentId && ACTIVE_OBSERVATION.includes(o.status),
  ) ?? null

const latestObservation = (assessmentId) =>
  load()
    .observations.filter((o) => o.assessmentId === assessmentId)
    .sort((a, b) => b.attemptNo - a.attemptNo)[0] ?? null

function attentionFor(assessment) {
  if (!["signed_up", "candidates_generated"].includes(assessment.status)) return null
  const list = latestList(assessment.id)
  if (list && list.poolSize === 0) return "no_eligible_observers"
  const last = latestObservation(assessment.id)
  if (last?.status === "not_completed") return "observation_not_completed"
  if (list) {
    // Only requests sent after the last pairing count: an AC rejection or a
    // missed observation hands the turn back to the professor, it isn't "unanswered".
    const sinceId = last?.requestId ?? 0
    const fresh = load().requests.filter((r) => r.listId === list.id && r.id > sinceId)
    if (
      fresh.length > 0 &&
      fresh.every((r) => ["declined", "expired", "cancelled"].includes(r.status))
    ) {
      return "requests_unanswered"
    }
  }
  return null
}

function requestView(request) {
  return {
    id: request.id,
    assessmentId: request.assessmentId,
    observerId: request.observerId,
    status: request.status,
    requestedAt: request.requestedAt,
    expiresAt: request.expiresAt,
    respondedAt: request.respondedAt,
    observer: teacherBrief(request.observerId),
  }
}

function observationView(observation) {
  const s = load()
  const assessment = byId(s.assessments, observation.assessmentId)
  const reviewer = observation.acReviewedBy && byId(s.users, observation.acReviewedBy)
  const reviewerTeacher = reviewer?.teacherId && byId(s.teachers, reviewer.teacherId)
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
    acReviewedAt: observation.acReviewedAt,
    acReviewedBy: reviewerTeacher
      ? `${reviewerTeacher.firstName} ${reviewerTeacher.lastName}`
      : reviewer
        ? reviewer.email
        : null,
    acNotes: observation.acNotes,
    observerSignedOffAt: observation.observerSignedOffAt,
    observeeSignedOffAt: observation.observeeSignedOffAt,
    observeeComment: observation.observeeComment,
    retryAfter: observation.retryAfter,
    notCompletedReason: observation.notCompletedReason,
    createdAt: observation.createdAt,
    updatedAt: observation.updatedAt,
  }
}

function assessmentView(assessment) {
  const s = load()
  const pairing = activeObservation(assessment.id) ?? latestObservation(assessment.id)
  const list = latestList(assessment.id)
  const requests = list ? s.requests.filter((r) => r.listId === list.id) : []
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
    attention: attentionFor(assessment),
    pairing: pairing ? observationView(pairing) : null,
    candidateSummary: list ? { poolSize: list.poolSize, listSize: list.listSize } : null,
    requestSummary: {
      pending: requests.filter((r) => r.status === "pending").length,
      accepted: requests.filter((r) => r.status === "accepted").length,
      total: requests.length,
    },
  }
}

// GET /assessments/:id and POST /assessments/:id/candidates share this shape.
function assessmentDetail(assessment) {
  const s = load()
  const list = latestList(assessment.id)
  const requests = list ? s.requests.filter((r) => r.listId === list.id) : []
  const rows = list
    ? s.candidates
        .filter((c) => c.listId === list.id)
        .sort((a, b) => a.position - b.position)
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
    candidates: rows.map((candidate) => {
      const request = requests
        .filter((r) => r.observerId === candidate.teacherId)
        .sort((a, b) => b.id - a.id)[0]
      return {
        ...teacherBrief(candidate.teacherId),
        position: candidate.position,
        request: request ? requestView(request) : null,
      }
    }),
    requests: requests.map(requestView),
    observations: s.observations
      .filter((o) => o.assessmentId === assessment.id)
      .sort((a, b) => a.attemptNo - b.attemptNo)
      .map(observationView),
  }
}

function incomingRequestView(request) {
  const s = load()
  const assessment = byId(s.assessments, request.assessmentId)
  return {
    ...requestView(request),
    observee: teacherBrief(assessment.teacherId),
    section: sectionView(assessment.sectionId),
    assessmentStatus: assessment.status,
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

// The observer picks a real class date: today or later, inside the term, on a
// day the section meets.
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

function cancelPendingRequests(assessmentId, exceptId = null) {
  const s = load()
  for (const request of s.requests) {
    if (
      request.assessmentId === assessmentId &&
      request.status === "pending" &&
      request.id !== exceptId
    ) {
      request.status = "cancelled"
      request.respondedAt = nowISO()
    }
  }
}

function touch(row) {
  row.updatedAt = nowISO()
}

function createObservation(assessment, fields) {
  const s = load()
  const attemptNo = (latestObservation(assessment.id)?.attemptNo ?? 0) + 1
  const observation = {
    id: s.nextId.observation++,
    assessmentId: assessment.id,
    observeeId: assessment.teacherId,
    observerId: fields.observerId,
    attemptNo,
    status: "proposed",
    isAcStepin: fields.isAcStepin,
    sourceListId: fields.sourceListId ?? null,
    requestId: fields.requestId ?? null,
    scheduledDate: fields.scheduledDate ?? null,
    acReviewedBy: null,
    acReviewedAt: null,
    acNotes: null,
    observerSignedOffAt: null,
    observeeSignedOffAt: null,
    observeeComment: null,
    retryAfter: null,
    notCompletedReason: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  s.observations.push(observation)
  assessment.status = "pending_ac_approval"
  touch(assessment)
  return observation
}

function getObservationFor(user, id) {
  const observation = byId(load().observations, id)
  if (!observation) throw fail(404, "not_found", "Observation not found")
  const isParty =
    user.teacherId &&
    [observation.observerId, observation.observeeId].includes(user.teacherId)
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

// [new] committee dashboard feed — must be registered before /assessments/:id
route("GET", "/assessments/queue", ({ user }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const s = load()
  const pendingApproval = s.observations
    .filter((o) => o.status === "proposed")
    .map((o) => ({
      ...observationView(o),
      assessment: assessmentView(byId(s.assessments, o.assessmentId)),
    }))
  const needsAttention = s.assessments
    .filter((a) => attentionFor(a))
    .map(assessmentView)
  const awaitingSignOff = s.observations
    .filter((o) => o.status === "approved")
    .map(observationView)
  return {
    pendingApproval,
    needsAttention,
    awaitingSignOff,
    counts: {
      pendingApproval: pendingApproval.length,
      needsAttention: needsAttention.length,
      awaitingSignOff: awaitingSignOff.length,
    },
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

route("POST", "/assessments/(\\d+)/cancel", ({ user, match, body }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const assessment = getAssessmentFor(user, match[1])
  if (["completed", "cancelled"].includes(assessment.status)) {
    throw fail(404, "not_found", "Cancellable assessment not found")
  }
  assessment.status = "cancelled"
  assessment.notes = body?.reason ? `[${body.reason}] ${body.notes ?? ""}`.trim() : body?.notes ?? null
  cancelPendingRequests(assessment.id)
  for (const o of load().observations) {
    if (o.assessmentId === assessment.id && ACTIVE_OBSERVATION.includes(o.status)) {
      o.status = "postponed"
      touch(o)
    }
  }
  touch(assessment)
  save()
  return assessmentView(assessment)
})

// [backend, response extended] surface up to 5 observer candidates to the
// requesting professor. Calling it again returns the same list (no reshuffling
// to fish for a nicer list) unless nobody qualified last time.
route("POST", "/assessments/(\\d+)/candidates", ({ user, match }) => {
  const s = load()
  const assessment = getAssessmentFor(user, match[1])
  if (!["signed_up", "candidates_generated"].includes(assessment.status)) {
    throw fail(409, "conflict", "Observer candidates can only be generated before a pairing is proposed.")
  }
  const existing = latestList(assessment.id)
  if (existing && existing.poolSize > 0) return assessmentDetail(assessment)

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
  // through `attention: "no_eligible_observers"` (requirements §4.2).
  if (picked.length > 0) assessment.status = "candidates_generated"
  touch(assessment)
  save()
  return assessmentDetail(assessment)
})

// [new] the observee sends requests (not invitations) to any of the listed candidates.
route("POST", "/assessments/(\\d+)/requests", ({ user, match, body }) => {
  const s = load()
  const assessment = getAssessmentFor(user, match[1])
  if (assessment.status !== "candidates_generated") {
    throw fail(409, "conflict", "Requests can only be sent while you're choosing an observer.")
  }
  const list = latestList(assessment.id)
  const ids = [...new Set(body?.observerIds ?? [])]
  if (!list || ids.length === 0) {
    throw fail(400, "validation_error", "Select at least one observer.")
  }
  const listed = s.candidates.filter((c) => c.listId === list.id).map((c) => c.teacherId)
  if (ids.some((id) => !listed.includes(id))) {
    throw fail(409, "conflict", "You can only send requests to observers on your candidate list.")
  }
  if (
    s.requests.some(
      (r) => r.assessmentId === assessment.id && r.status === "pending" && ids.includes(r.observerId),
    )
  ) {
    throw fail(409, "conflict", "A request to one of those observers is already pending.")
  }
  const now = Date.now()
  for (const observerId of ids) {
    s.requests.push({
      id: s.nextId.request++,
      assessmentId: assessment.id,
      listId: list.id,
      observerId,
      status: "pending",
      requestedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + APP_SETTINGS.requestExpiryHours * HOUR).toISOString(),
      respondedAt: null,
    })
  }
  save()
  return assessmentDetail(assessment)
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

// [backend, extended] the committee assigns an observer directly (step-in, or
// pairing from the list on the professor's behalf). Still goes through review.
route("POST", "/assessments/(\\d+)/observations", ({ user, match, body }) => {
  if (!isAC(user)) {
    throw fail(403, "forbidden", "Send a request to a candidate instead — only the committee assigns observers directly.")
  }
  const s = load()
  const assessment = getAssessmentFor(user, match[1])
  if (!["signed_up", "candidates_generated"].includes(assessment.status) || activeObservation(assessment.id)) {
    throw fail(409, "conflict", "This sign-up already has an observer pairing in progress.")
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
  checkObservationDate(section, body?.scheduledDate) // an approved pairing always has a class date
  cancelPendingRequests(assessment.id)
  const observation = createObservation(assessment, {
    observerId: observer.id,
    isAcStepin: isStepin,
    sourceListId: body?.candidateListId ?? null,
    scheduledDate: body.scheduledDate,
  })
  save()
  return { observation: observationView(observation), assessment: assessmentView(assessment) }
})

// [new] committee: postpone to the next semester.
route("POST", "/assessments/(\\d+)/postpone", ({ user, match, body }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "You do not have permission to do that")
  const assessment = getAssessmentFor(user, match[1])
  if (["completed", "cancelled", "postponed"].includes(assessment.status)) {
    throw fail(409, "conflict", "This sign-up can no longer be postponed.")
  }
  assessment.status = "postponed"
  assessment.notes = body?.notes ?? assessment.notes
  cancelPendingRequests(assessment.id)
  for (const o of load().observations) {
    if (o.assessmentId === assessment.id && ACTIVE_OBSERVATION.includes(o.status)) {
      o.status = "postponed"
      touch(o)
    }
  }
  touch(assessment)
  save()
  return assessmentView(assessment)
})

// -- observer requests [new]
route("GET", "/observer-requests/incoming", ({ user }) => {
  const teacherId = requireTeacher(user)
  const rank = { pending: 0, accepted: 1 }
  return {
    data: load()
      .requests.filter((r) => r.observerId === teacherId)
      .sort(
        (a, b) =>
          (rank[a.status] ?? 2) - (rank[b.status] ?? 2) || b.requestedAt.localeCompare(a.requestedAt),
      )
      .map(incomingRequestView),
  }
})

function getRequest(id) {
  const request = byId(load().requests, id)
  if (!request) throw fail(404, "not_found", "Request not found")
  return request
}

route("POST", "/observer-requests/(\\d+)/accept", ({ user, match, body }) => {
  const s = load()
  const request = getRequest(match[1])
  if (request.observerId !== user.teacherId) {
    throw fail(403, "forbidden", "This request was sent to someone else.")
  }
  if (request.status !== "pending") {
    throw fail(409, "conflict", `This request is ${request.status} and can't be accepted.`)
  }
  const assessment = byId(s.assessments, request.assessmentId)
  if (assessment.status !== "candidates_generated" || activeObservation(assessment.id)) {
    throw fail(409, "conflict", "This observation already has an observer.")
  }
  const section = byId(s.sections, assessment.sectionId)
  checkObservationDate(section, body?.scheduledDate)
  request.status = "accepted"
  request.respondedAt = nowISO()
  cancelPendingRequests(assessment.id, request.id) // one acceptance auto-cancels the rest
  createObservation(assessment, {
    observerId: request.observerId,
    isAcStepin: false,
    sourceListId: request.listId,
    requestId: request.id,
    scheduledDate: body.scheduledDate,
  })
  save()
  return incomingRequestView(request)
})

route("POST", "/observer-requests/(\\d+)/decline", ({ user, match }) => {
  const request = getRequest(match[1])
  if (request.observerId !== user.teacherId) {
    throw fail(403, "forbidden", "This request was sent to someone else.")
  }
  if (request.status !== "pending") {
    throw fail(409, "conflict", `This request is ${request.status} and can't be declined.`)
  }
  request.status = "declined"
  request.respondedAt = nowISO()
  save()
  return incomingRequestView(request)
})

route("POST", "/observer-requests/(\\d+)/cancel", ({ user, match }) => {
  const request = getRequest(match[1])
  getAssessmentFor(user, request.assessmentId) // owner or committee
  if (request.status !== "pending") {
    throw fail(409, "conflict", `This request is ${request.status} and can't be cancelled.`)
  }
  request.status = "cancelled"
  request.respondedAt = nowISO()
  save()
  return requestView(request)
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

route("GET", "/observations/(\\d+)", ({ user, match }) =>
  observationView(getObservationFor(user, match[1]).observation),
)

// [backend, extended] AC approval gate.
route("POST", "/observations/(\\d+)/review", ({ user, match, body }) => {
  if (!isAC(user)) throw fail(403, "forbidden", "Only AC/admin can review observations")
  const s = load()
  const { observation } = getObservationFor(user, match[1])
  if (observation.status !== "proposed") {
    throw fail(409, "conflict", "Only proposed observations can be reviewed")
  }
  if (!["approved", "rejected"].includes(body?.decision)) {
    throw fail(400, "validation_error", "Choose approve or reject.")
  }
  if (body.decision === "rejected" && !body.notes?.trim()) {
    throw fail(400, "validation_error", "Add a note explaining why the pairing was rejected.")
  }
  // Patched rule: nobody approves a pairing they're part of.
  if (user.teacherId && [observation.observerId, observation.observeeId].includes(user.teacherId)) {
    throw fail(403, "forbidden", "You're part of this pairing — another committee member must review it.")
  }
  const assessment = byId(s.assessments, observation.assessmentId)
  observation.status = body.decision
  observation.acReviewedBy = user.id
  observation.acReviewedAt = nowISO()
  observation.acNotes = body.notes?.trim() || null
  assessment.status = body.decision === "approved" ? "approved" : "candidates_generated"
  touch(observation)
  touch(assessment)
  save()
  return { observation: observationView(observation), assessment: assessmentView(assessment) }
})

// [new] Both observer and observee sign off. Observee sign-off confirms the
// observation happened — not agreement with the ratings.
route("POST", "/observations/(\\d+)/sign-off", ({ user, match, body }) => {
  const s = load()
  const { observation } = getObservationFor(user, match[1])
  assertNotCompleted(observation)
  if (observation.status !== "approved") {
    throw fail(409, "conflict", "The committee must approve this pairing before anyone can sign off.")
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

route("POST", "/observations/(\\d+)/reschedule", ({ user, match, body }) => {
  const s = load()
  const { observation } = getObservationFor(user, match[1])
  assertNotCompleted(observation)
  if (observation.status !== "approved") {
    throw fail(409, "conflict", "Only an approved observation can be rescheduled.")
  }
  const assessment = byId(s.assessments, observation.assessmentId)
  checkObservationDate(byId(s.sections, assessment.sectionId), body?.scheduledDate)
  observation.scheduledDate = body.scheduledDate
  // Both people confirm the new plan; earlier sign-offs no longer apply.
  observation.observerSignedOffAt = null
  observation.observeeSignedOffAt = null
  touch(observation)
  save()
  return observationView(observation)
})

// The observation didn't happen (illness, conflict…). Retry window is 3–4 weeks.
route("POST", "/observations/(\\d+)/not-completed", ({ user, match, body }) => {
  const s = load()
  const { observation } = getObservationFor(user, match[1])
  assertNotCompleted(observation)
  if (observation.status !== "approved") {
    throw fail(409, "conflict", "Only an approved observation can be reported as not completed.")
  }
  if (!body?.reason?.trim()) {
    throw fail(400, "validation_error", "Tell the committee what happened.")
  }
  const assessment = byId(s.assessments, observation.assessmentId)
  observation.status = "not_completed"
  observation.notCompletedReason = body.reason.trim()
  observation.retryAfter = isoDay(new Date(Date.now() + APP_SETTINGS.retryWindowWeeks * 7 * DAY))
  assessment.status = "candidates_generated" // back to choosing an observer; committee is alerted
  touch(observation)
  touch(assessment)
  save()
  return observationView(observation)
})

// ---------------------------------------------------------------- entry ----

export async function mockRequest(path, { method = "GET", body, token } = {}) {
  await wait()
  load()
  expireRequests()

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
