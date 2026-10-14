import { termIndex } from "./dueStatus"

// Sorting for the Professors page. Each key returns a number or string; an empty
// value (null) always goes to the bottom.
const RANK_ORDER = { assistant_professor: 0, associate_professor: 1, full_professor: 2 }
const DUE_ORDER = { overdue: 0, due: 1, never_observed: 2, not_due: 3 }
const CURRENT_ORDER = { none: 0, selecting_observer: 1, request_sent: 2, scheduled: 3, postponed: 4, completed: 5 }

const nameOf = (row) => `${row.lastName} ${row.firstName}`.toLowerCase()

export const SORT_KEYS = {
  name: nameOf,
  department: (row) => row.department.toLowerCase(),
  rank: (row) => RANK_ORDER[row.rank] ?? 9,
  due: (row) => DUE_ORDER[row.dueStatus] ?? 9,
  // Never observed means due now, so it sorts before every dated semester.
  nextDue: (row) => (row.dueStatus === "never_observed" ? -1 : row.dueTerm ? termIndex(row.dueTerm) : null),
  lastObserved: (row) => row.lastCompleted?.date ?? null,
  current: (row) => CURRENT_ORDER[row.currentStatus] ?? 9,
  signUp: (row) => (row.signUp ? 1 : 0),
}

// `sort` is { key, direction: "asc" | "desc" }. Ties fall back to the name.
export function sortRows(rows, { key, direction }) {
  const valueOf = SORT_KEYS[key] ?? nameOf
  const sign = direction === "desc" ? -1 : 1
  return [...rows].sort((a, b) => {
    const left = valueOf(a)
    const right = valueOf(b)
    if (left === null || right === null) {
      if (left === right) return nameOf(a).localeCompare(nameOf(b))
      return left === null ? 1 : -1
    }
    if (left === right) return nameOf(a).localeCompare(nameOf(b))
    return left < right ? -sign : sign
  })
}
