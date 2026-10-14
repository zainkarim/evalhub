// Seed data for the in-browser mock API (see mockServer.js).
//
// It mirrors backend/db/seeds/dev_seed.sql (same personas, ids, terms, courses
// and sections) plus a few mock-only rows so every screen has something to
// show on first load. Instructors are personas — never real names.
//
// Extra rows that do NOT exist in the real seed are marked "mock-only".

export const DEMO_PASSWORD = "ChangeMe-Dev-123!"

export const APP_SETTINGS = {
  candidateListSize: 5,
  observerLookbackYears: 2,
  requestExpiryHours: 48,
}

const terms = [
  [1, "fall", 2023, "2023-08-21", "2023-12-15"],
  [2, "spring", 2024, "2024-01-08", "2024-05-10"],
  [3, "summer", 2024, "2024-05-20", "2024-08-09"],
  [4, "fall", 2024, "2024-08-19", "2024-12-13"],
  [5, "spring", 2025, "2025-01-13", "2025-05-09"],
  [6, "summer", 2025, "2025-05-19", "2025-08-08"],
  [7, "fall", 2025, "2025-08-18", "2025-12-12"],
  [8, "spring", 2026, "2026-01-12", "2026-05-08"],
  [9, "summer", 2026, "2026-05-18", "2026-08-07"],
  [10, "fall", 2026, "2026-08-17", "2026-12-11"],
  [11, "spring", 2027, "2027-01-11", "2027-05-07"],
].map(([id, season, year, startDate, endDate]) => ({
  id,
  season,
  year,
  startDate,
  endDate,
  isLongTerm: season !== "summer",
  signupDeadline: null, // mock-only; buildSeed() sets it for the open terms
}))

const teachers = [
  [1, "A", "ECS", "associate_professor"],
  [2, "B", "ECS", "full_professor"],
  [3, "C", "ECS", "assistant_professor"],
  [4, "D", "ECS", "associate_professor"],
  [5, "E", "ECS", "assistant_professor"],
  [6, "F", "ECS", "full_professor"],
  [7, "G", "ECS", "associate_professor"],
  [8, "H", "ECS", "assistant_professor"],
  [9, "I", "EPPS", "full_professor"],
  [10, "J", "EPPS", "associate_professor"],
].map(([id, letter, school, rank]) => ({
  id,
  firstName: "Professor",
  lastName: letter,
  email: `professor.${letter.toLowerCase()}@example.edu`,
  school,
  rank,
  isActive: true,
}))

const courses = [
  [1, "CS", "ECS", "1337", "Computer Science I"],
  [2, "CS", "ECS", "2305", "Discrete Mathematics"],
  [3, "CS", "ECS", "3345", "Data Structures and Algorithms"],
  [4, "CS", "ECS", "3354", "Software Engineering"],
  [5, "CS", "ECS", "4348", "Operating Systems Concepts"],
  [6, "CS", "ECS", "4485", "Computer Science Project"],
  [7, "CS", "ECS", "6360", "Database Design"],
  [8, "EPPS", "EPPS", "4310", "Policy Research Methods"],
  [9, "EPPS", "EPPS", "2301", "Introduction to Public Policy"], // mock-only
].map(([id, subject, school, courseNumber, title]) => ({
  id,
  subject,
  school,
  courseNumber,
  title,
  courseLevel: Number(courseNumber[0]),
  source: "seed",
  externalId: null,
}))

// [id, courseId, termId, section, teacherId, days, start, end, location]
// Meeting times and locations are mock-only (the real seed leaves them NULL).
const sections = [
  [1, 3, 4, "001", 1, "MW", "10:00", "11:15", "ECSS 2.201"],
  [2, 5, 4, "001", 1, "TR", "10:00", "11:15", "ECSS 2.410"],
  [3, 6, 5, "001", 2, "F", "13:00", "15:45", "ECSS 3.100"],
  [4, 1, 5, "001", 8, "MW", "08:30", "09:45", "ECSW 1.315"],
  [5, 5, 2, "001", 7, "TR", "13:00", "14:15", "ECSS 2.410"],
  [6, 2, 4, "001", 7, "MW", "13:00", "14:15", "ECSW 1.365"],
  [7, 4, 7, "001", 4, "TR", "11:30", "12:45", "ECSS 2.412"],
  [8, 5, 7, "001", 4, "MW", "14:30", "15:45", "ECSS 2.410"],
  [9, 6, 7, "001", 6, "F", "13:00", "15:45", "ECSS 3.100"],
  [10, 3, 7, "001", 8, "TR", "10:00", "11:15", "ECSW 1.365"],
  [11, 7, 7, "001", 2, "W", "17:30", "20:15", "ECSS 2.203"],
  [12, 1, 7, "001", 3, "MW", "13:00", "14:15", "ECSW 1.315"],
  [13, 8, 7, "001", 9, "TR", "15:30", "16:45", "GR 3.302"],
  [14, 3, 8, "001", 6, "MW", "10:00", "11:15", "ECSW 1.365"],
  [15, 4, 8, "001", 7, "TR", "10:00", "11:15", "ECSS 2.412"],
  [16, 6, 8, "001", 2, "F", "13:00", "15:45", "ECSS 3.100"],
  [17, 2, 8, "001", 3, "MW", "13:00", "14:15", "ECSW 1.365"],
  [18, 8, 8, "001", 10, "TR", "15:30", "16:45", "GR 3.302"],
  [19, 4, 10, "001", 2, "MW", "10:00", "11:15", "ECSS 2.412"],
  [20, 4, 10, "002", 5, "TR", "10:00", "11:15", "ECSS 2.412"],
  [21, 1, 10, "001", 3, "MW", "13:00", "14:15", "ECSW 1.315"],
  [22, 6, 10, "001", 6, "F", "13:00", "15:45", "ECSS 3.100"],
  [23, 2, 10, "001", 3, "TR", "11:30", "12:45", "ECSW 1.365"], // mock-only: gives Professor C a second sign-up
  [24, 9, 10, "001", 9, "TR", "09:00", "10:15", "GR 3.302"], // mock-only: level with no other instructor -> zero eligible observers
  [25, 4, 11, "001", 5, "MW", "10:00", "11:15", "ECSS 2.412"], // mock-only: Spring 2027 section, its sign-up deadline is still ahead
].map(
  ([id, courseId, termId, sectionNumber, teacherId, meetingDays, startTime, endTime, location]) => ({
    id,
    courseId,
    termId,
    sectionNumber,
    teacherId,
    meetingDays,
    startTime,
    endTime,
    location,
    source: "seed",
    externalId: null,
  }),
)

// Demo logins. The first three match `npm run seed` in the backend; the rest
// are mock-only so a reviewer can also sign in as an observer.
const users = [
  { id: 1, email: "admin@example.edu", role: "admin", teacherId: null },
  { id: 2, email: "ac@example.edu", role: "ac_member", teacherId: 2 },
  { id: 3, email: "faculty@example.edu", role: "faculty", teacherId: 3 },
  ...[1, 4, 5, 6, 7, 8, 9, 10].map((teacherId, index) => ({
    id: 4 + index,
    email: teachers[teacherId - 1].email,
    role: "faculty",
    teacherId,
  })),
]

const DAY = 24 * 60 * 60 * 1000
const WEEKDAY = ["U", "M", "T", "W", "R", "F", "S"]

function isoDay(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function buildSeed(now = new Date()) {
  const iso = (offsetMs) => new Date(now.getTime() + offsetMs).toISOString()
  const day = (offsetDays) => isoDay(new Date(now.getTime() + offsetDays * DAY))
  // The n-th class meeting (0 = first) on or after (dir 1) / on or before (dir -1)
  // the day `offsetDays` from now, so seeded dates fall on the section's meeting days.
  const classDay = (meetingDays, offsetDays, n = 0, dir = 1) => {
    let seen = -1
    for (let i = 0; i < 400; i++) {
      const date = new Date(now.getTime() + (offsetDays + i * dir) * DAY)
      if (meetingDays.includes(WEEKDAY[date.getDay()]) && ++seen === n) return isoDay(date)
    }
    return day(offsetDays)
  }

  // Sign-up deadlines are mock-only (the backend has no such field). Fall 2026
  // is already past, so the committee can start observer selection; Spring 2027
  // is still ahead, so Start Observer Selection shows as locked.
  const seededTerms = terms.map((term) =>
    term.id === 10
      ? { ...term, signupDeadline: day(-10) }
      : term.id === 11
        ? { ...term, signupDeadline: day(30) }
        : term,
  )

  const assessments = [
    // Same two rows as the real seed.
    // Waiting for the committee to start observer selection.
    { id: 1, teacherId: 3, sectionId: 21, dueTermId: 10, status: "signed_up", completedAt: null },
    { id: 2, teacherId: 3, sectionId: 17, dueTermId: 8, status: "completed", completedAt: iso(-150 * DAY) },
    // mock-only: Professor F has a confirmed date that has now passed -> sign-off is open.
    { id: 3, teacherId: 6, sectionId: 22, dueTermId: 10, status: "approved", completedAt: null },
    // mock-only: Professor I has no eligible observers -> the committee assigns manually.
    { id: 4, teacherId: 9, sectionId: 24, dueTermId: 10, status: "signed_up", completedAt: null },
    // mock-only: Professor B has a first attempt that did not happen -> Postponed, with its history.
    { id: 5, teacherId: 2, sectionId: 19, dueTermId: 10, status: "postponed", completedAt: null },
  ].map((row, index) => ({
    ...row,
    notes: null,
    signedUpAt: iso(-(20 - index * 3) * DAY),
    createdAt: iso(-(20 - index * 3) * DAY),
    updatedAt: iso(-index * DAY),
  }))

  const candidateLists = [
    { id: 1, assessmentId: 3, targetLevel: 4, targetSchool: "ECS", poolSize: 3, listSize: 3, generatedAt: iso(-5 * DAY) },
    { id: 2, assessmentId: 4, targetLevel: 2, targetSchool: "EPPS", poolSize: 0, listSize: 0, generatedAt: iso(-3 * DAY) },
    { id: 3, assessmentId: 5, targetLevel: 3, targetSchool: "ECS", poolSize: 6, listSize: 5, generatedAt: iso(-14 * DAY) },
  ]

  const candidates = [
    { listId: 1, teacherId: 1, position: 1 },
    { listId: 1, teacherId: 4, position: 2 },
    { listId: 1, teacherId: 2, position: 3 },
    ...[1, 4, 5, 6, 7].map((teacherId, index) => ({ listId: 3, teacherId, position: index + 1 })),
  ]

  // assessment_time_options rows (migration 004) plus a mock-only attemptNo.
  const option = (id, assessmentId, proposedDate, start, end, offeredTo, confirmed, attemptNo = 1) => ({
    id,
    assessmentId,
    proposedDate,
    startTime: start,
    endTime: end,
    offeredToTeacherId: offeredTo,
    isConfirmed: confirmed,
    attemptNo,
    createdAt: iso(-5 * DAY),
  })
  const timeOptions = [
    // Professor F -> Professor D, who confirmed a date that has now passed.
    option(1, 3, classDay("F", -1, 0, -1), "13:00", "15:45", 4, true),
    option(2, 3, classDay("F", 6, 0), "13:00", "15:45", null, false),
    option(3, 3, classDay("F", 6, 1), "13:00", "15:45", null, false),
    option(4, 3, classDay("F", 6, 2), "13:00", "15:45", null, false),
    option(5, 3, classDay("F", 6, 3), "13:00", "15:45", null, false),
    // Professor B -> Professor D, confirmed, then the attempt was postponed.
    option(6, 5, classDay("MW", 3, 0), "10:00", "11:15", 4, true),
    option(7, 5, classDay("MW", 3, 1), "10:00", "11:15", null, false),
    option(8, 5, classDay("MW", 3, 2), "10:00", "11:15", null, false),
    option(9, 5, classDay("MW", 3, 3), "10:00", "11:15", null, false),
    option(10, 5, classDay("MW", 3, 4), "10:00", "11:15", null, false),
    // Professor B -> Professor E first: never answered, expired after 48h.
    option(11, 5, classDay("MW", 4, 0), "10:00", "11:15", null, false),
    option(12, 5, classDay("MW", 4, 1), "10:00", "11:15", null, false),
    option(13, 5, classDay("MW", 4, 2), "10:00", "11:15", null, false),
    option(14, 5, classDay("MW", 4, 3), "10:00", "11:15", null, false),
    option(15, 5, classDay("MW", 4, 4), "10:00", "11:15", null, false),
  ]

  // One row per request sent to one observer (mock-only; the backend only has
  // offered_to_teacher_id on the options).
  const offers = [
    { id: 1, assessmentId: 3, observerId: 2, attemptNo: 1, status: "declined", sentAt: iso(-4.5 * DAY), expiresAt: iso(-2.5 * DAY), respondedAt: iso(-4.2 * DAY), reason: "Teaching conflict on all five dates.", optionIds: [1, 2, 3, 4, 5] },
    { id: 2, assessmentId: 3, observerId: 4, attemptNo: 1, status: "confirmed", sentAt: iso(-4 * DAY), expiresAt: iso(-2 * DAY), respondedAt: iso(-3.5 * DAY), reason: null, optionIds: [1, 2, 3, 4, 5] },
    { id: 3, assessmentId: 5, observerId: 5, attemptNo: 1, status: "expired", sentAt: iso(-10 * DAY), expiresAt: iso(-8 * DAY), respondedAt: null, reason: null, optionIds: [11, 12, 13, 14, 15] },
    { id: 4, assessmentId: 5, observerId: 4, attemptNo: 1, status: "confirmed", sentAt: iso(-8 * DAY), expiresAt: iso(-6 * DAY), respondedAt: iso(-7 * DAY), reason: null, optionIds: [6, 7, 8, 9, 10] },
  ]

  const observations = [
    {
      id: 1,
      assessmentId: 2,
      observeeId: 3,
      observerId: 7,
      attemptNo: 1,
      status: "completed",
      isAcStepin: false,
      sourceListId: null,
      scheduledDate: "2026-03-04",
      observerSignedOffAt: iso(-152 * DAY),
      observeeSignedOffAt: iso(-151 * DAY),
      observeeComment: null,
      retryAfter: null,
      createdAt: iso(-175 * DAY),
      updatedAt: iso(-151 * DAY),
    },
    {
      id: 2,
      assessmentId: 3,
      observeeId: 6,
      observerId: 4,
      attemptNo: 1,
      status: "approved",
      isAcStepin: false,
      sourceListId: 1,
      scheduledDate: classDay("F", -1, 0, -1),
      observerSignedOffAt: null,
      observeeSignedOffAt: null,
      observeeComment: null,
      retryAfter: null,
      createdAt: iso(-3.5 * DAY),
      updatedAt: iso(-3.5 * DAY),
    },
    {
      id: 3,
      assessmentId: 5,
      observeeId: 2,
      observerId: 4,
      attemptNo: 1,
      status: "postponed",
      isAcStepin: false,
      sourceListId: 3,
      scheduledDate: classDay("MW", 3),
      observerSignedOffAt: null,
      observeeSignedOffAt: null,
      observeeComment: null,
      retryAfter: null,
      createdAt: iso(-7 * DAY),
      updatedAt: iso(-2 * DAY),
    },
  ]

  // Append-only attempt history: who, when, why. Nothing here is ever removed.
  const entry = (assessmentId, attemptNo, type, byName, byRole, offsetDays, extra = {}) => ({
    assessmentId,
    attemptNo,
    type,
    byName,
    byRole,
    at: iso(offsetDays * DAY),
    reason: null,
    observerId: null,
    date: null,
    count: null,
    ...extra,
  })
  const attemptLog = [
    entry(3, 1, "selection_started", "Professor B", "ac_member", -5),
    entry(3, 1, "request_sent", "Professor F", "faculty", -4.5, { observerId: 2, count: 5 }),
    entry(3, 1, "request_declined", "Professor B", "ac_member", -4.2, {
      observerId: 2,
      reason: "Teaching conflict on all five dates.",
    }),
    entry(3, 1, "request_sent", "Professor F", "faculty", -4, { observerId: 4, count: 5 }),
    entry(3, 1, "date_confirmed", "Professor D", "faculty", -3.5, { observerId: 4, date: classDay("F", -1, 0, -1) }),
    entry(4, 1, "selection_started", "Administrator", "admin", -3),
    entry(5, 1, "selection_started", "Administrator", "admin", -14),
    entry(5, 1, "request_sent", "Professor B", "ac_member", -10, { observerId: 5, count: 5 }),
    entry(5, 1, "no_response_expired", "System", "system", -8, {
      observerId: 5,
      reason: "No response within 48 hours.",
    }),
    entry(5, 1, "request_sent", "Professor B", "ac_member", -8, { observerId: 4, count: 5 }),
    entry(5, 1, "date_confirmed", "Professor D", "faculty", -7, { observerId: 4, date: classDay("MW", 3) }),
    entry(5, 1, "did_not_happen", "Professor D", "faculty", -2, {
      observerId: 4,
      reason: "Out sick that week.",
    }),
  ].map((row, index) => ({ id: index + 1, ...row }))

  return {
    version: 2,
    terms: seededTerms,
    teachers,
    courses,
    sections,
    users,
    assessments,
    candidateLists,
    candidates,
    timeOptions,
    offers,
    observations,
    attemptLog,
    nextId: {
      assessment: 6,
      candidateList: 4,
      timeOption: 16,
      offer: 5,
      observation: 4,
      log: attemptLog.length + 1,
    },
  }
}
