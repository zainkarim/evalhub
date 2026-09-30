// Display helpers shared by the observation workflow pages.

const DAY_NAMES = { M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", S: "Sat", U: "Sun" }

export const fullName = (person) =>
  person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : "—"

export const formatRank = (rank) =>
  rank
    ? rank
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "—"

export const formatTerm = (term) =>
  term
    ? `${term.season.charAt(0).toUpperCase()}${term.season.slice(1)} ${term.year}`
    : "Unknown term"

// The API may send DATE columns as plain dates or as full ISO timestamps.
export const toDateOnly = (value) => (value ? String(value).slice(0, 10) : null)

export function formatDate(value) {
  const day = toDateOnly(value)
  if (!day) return "—"
  const [year, month, date] = day.split("-").map(Number)
  return new Date(year, month - 1, date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateTime(value) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// "MW" -> "Mon, Wed"
export const formatDays = (days) =>
  days
    ? days
        .split("")
        .map((code) => DAY_NAMES[code] ?? code)
        .join(", ")
    : "—"

// "13:00" -> "1:00 PM"
export function formatTime(value) {
  if (!value) return ""
  const [hours, minutes] = value.split(":").map(Number)
  const suffix = hours >= 12 ? "PM" : "AM"
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`
}

export function formatMeeting(section) {
  if (!section?.meetingDays) return "Meeting time not listed"
  const days = formatDays(section.meetingDays)
  return section.startTime && section.endTime
    ? `${days} · ${formatTime(section.startTime)}–${formatTime(section.endTime)}`
    : days
}

export const courseLabel = (course) =>
  course ? `${course.subject} ${course.courseNumber}` : "Unknown course"

export const todayISO = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

// "in 47h", "in 12m", "expired"
export function timeLeft(isoTimestamp, now = Date.now()) {
  const ms = new Date(isoTimestamp).getTime() - now
  if (ms <= 0) return "expired"
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)}m left`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`
}

// Class dates (YYYY-MM-DD) a section actually meets on inside its term, from
// today onward. The observer picks one of these when accepting a request.
export function meetingDates(section, { from = todayISO(), limit = 40 } = {}) {
  const term = section?.term
  if (!term || !section.meetingDays) return []
  const start = toDateOnly(term.startDate) > from ? toDateOnly(term.startDate) : from
  const end = toDateOnly(term.endDate)
  const codes = ["U", "M", "T", "W", "R", "F", "S"]
  const dates = []
  const cursor = new Date(`${start}T12:00:00`)
  while (dates.length < limit) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
    if (iso > end) break
    if (section.meetingDays.includes(codes[cursor.getDay()])) dates.push(iso)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

// Assessment (sign-up) status -> label + colour tone.
export const ASSESSMENT_STATUS = {
  signed_up: { label: "Signed up", tone: "neutral" },
  candidates_generated: { label: "Choosing observer", tone: "info" },
  pending_ac_approval: { label: "Awaiting AC approval", tone: "warn" },
  approved: { label: "Approved · scheduled", tone: "good" },
  completed: { label: "Completed", tone: "done" },
  not_eligible: { label: "Not eligible", tone: "neutral" },
  postponed: { label: "Postponed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
}

export const OBSERVATION_STATUS = {
  proposed: { label: "Awaiting AC approval", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected by AC", tone: "bad" },
  completed: { label: "Completed", tone: "done" },
  not_completed: { label: "Did not happen", tone: "bad" },
  postponed: { label: "Postponed", tone: "neutral" },
}

export const REQUEST_STATUS = {
  pending: { label: "Pending", tone: "info" },
  accepted: { label: "Accepted", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
  expired: { label: "Expired", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
}

export const ATTENTION = {
  no_eligible_observers: "No eligible observers found — an AC member needs to step in.",
  observation_not_completed:
    "The observation did not happen — reschedule, step in, or postpone.",
  requests_unanswered:
    "Every request was declined or expired — the professor can re-send, or an AC member can step in.",
}
