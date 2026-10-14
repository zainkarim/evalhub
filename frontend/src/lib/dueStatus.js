// Who is due for an observation, from rank + last observed term + the term being
// looked at. Pure functions: no clock, no React, no network, so the Node check
// (scripts/check-due.mjs) and any other page (e.g. the faculty dashboard) can reuse
// them. Rules are the professor's own, docs/resources/process-explanation.pdf and
// requirements §4.1:
//   - Assistant professor: once in every calendar year. Last observed Spring 2025 ->
//     due Spring or Fall 2026, overdue from Spring 2027.
//   - Associate / Full: once every 2 years, Summer terms not counted. Last observed
//     Spring 2025 -> due Spring 2027, overdue from Fall 2027.
//   - Never observed -> due (§4.1 has no first-semester exemption).
// Terms are `{ season: "spring" | "summer" | "fall", year }`.

// Years between observations. §4.1 says this must be configurable per professor
// (e.g. after a promotion), so callers may pass `frequencyYears` to override it.
export const DEFAULT_FREQUENCY_YEARS = { assistant: 1, other: 2 }

export const isAssistant = (rank) => rank === "assistant_professor"

export const frequencyYearsFor = (rank) =>
  isAssistant(rank) ? DEFAULT_FREQUENCY_YEARS.assistant : DEFAULT_FREQUENCY_YEARS.other

// Position in the Spring/Fall sequence (Summer is not counted). A Summer term takes
// the place of the Spring before it, so an observation held in Summer 2025 counts as
// Spring 2025 and a Summer reference term is judged as that Spring.
export const termIndex = ({ season, year }) => year * 2 + (season === "fall" ? 1 : 0)

export const termFromIndex = (index) => ({
  season: index % 2 === 1 ? "fall" : "spring",
  year: Math.floor(index / 2),
})

export const termLabel = (term) =>
  term ? `${term.season.charAt(0).toUpperCase()}${term.season.slice(1)} ${term.year}` : "—"

// The status keys, labels and badge tones the Professors page shows.
export const DUE_STATUS = {
  due: { label: "Due this semester", tone: "warn" },
  overdue: { label: "Overdue", tone: "bad" },
  not_due: { label: "Not due yet", tone: "neutral" },
  never_observed: { label: "Never observed", tone: "info" },
}

/**
 * @param {object} input
 * @param {string} input.rank                 assistant_professor | associate_professor | full_professor
 * @param {object|null} input.lastObservedTerm term of the last COMPLETED observation (as observee), or null
 * @param {object} input.term                 the semester being reported
 * @param {number} [input.frequencyYears]     per-professor override of the default years
 * @returns {{ status: string, dueTerm: object|null, dueWindow: object[] }}
 *   `dueTerm` is the first semester the professor is/was due (null if never observed);
 *   `dueWindow` is every semester that counts as "due" (two for an Assistant professor).
 */
export function computeDue({ rank, lastObservedTerm, term, frequencyYears }) {
  if (!lastObservedTerm) return { status: "never_observed", dueTerm: null, dueWindow: [] }

  const years = frequencyYears ?? frequencyYearsFor(rank)
  const now = termIndex(term)
  let windowStart
  let windowEnd

  if (isAssistant(rank)) {
    // Calendar-year rule: the whole year `years` after the last one is the window.
    windowStart = (lastObservedTerm.year + years) * 2
    windowEnd = windowStart + 1
  } else {
    // Two Spring/Fall terms per year, so 2 years = 4 terms; only that one term is "due".
    windowStart = termIndex(lastObservedTerm) + years * 2
    windowEnd = windowStart
  }

  const dueWindow = []
  for (let index = windowStart; index <= windowEnd; index += 1) dueWindow.push(termFromIndex(index))

  const status = now < windowStart ? "not_due" : now <= windowEnd ? "due" : "overdue"
  return { status, dueTerm: dueWindow[0], dueWindow }
}

// "Spring 2026 or Fall 2026" / "Spring 2027" — the semester(s) the professor is due.
export const describeWindow = (dueWindow) => dueWindow.map(termLabel).join(" or ")

// The "next due" column: when the professor is (or was) due.
export function describeDue({ status, dueWindow }) {
  if (status === "never_observed") return "Now (never observed)"
  if (!dueWindow?.length) return "—"
  return status === "overdue" ? `Was due ${termLabel(dueWindow[0])}` : describeWindow(dueWindow)
}

// The semester to open the page on: the one in progress, else the next Spring/Fall
// term. `terms` need `season`, `year`, `startDate`, `endDate`; `today` is YYYY-MM-DD.
export function defaultReportTerm(terms, today) {
  const cycle = terms
    .filter((term) => term.season !== "summer")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  return (
    cycle.find((term) => term.startDate <= today && today <= term.endDate) ??
    cycle.find((term) => term.startDate > today) ??
    cycle.at(-1) ??
    null
  )
}
