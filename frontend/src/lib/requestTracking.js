// Request tracking (issue #60): every observation request a professor sent, what
// happened to it, and every attempt. Pure functions (no React, no API calls), so
// scripts/check-requests.mjs can run them against the mock.
//
// The mock's AssessmentDetail carries `offers`, `observations` and `attempts`.
// The real backend doesn't send those yet (#104/#119), so every field is read
// defensively: without `offers` the requests are rebuilt from `timeOptions`
// (grouped by attempt and by the observer they were offered to), and without a
// nested `section` the flat `courseCode` / `sectionCode` are used.
import { courseLabel, formatTerm, formatTimeRange, toDateOnly } from "./format"

// Each request lands in exactly one filter group, so the tabs add up to "All".
// A withdrawn request goes with "No response" (it was never answered).
const GROUP = {
  pending: "active",
  confirmed: "confirmed",
  declined: "declined",
  expired: "expired",
  withdrawn: "expired",
  postponed: "postponed",
}

// Filter tabs, in order. `group` is what summarize() counts.
export const REQUEST_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "confirmed", label: "Confirmed" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "No response" },
  { id: "postponed", label: "Postponed" },
]

// Badge for a request whose attempt was postponed (shown next to the request's own
// status). Same shape as the maps in format.js.
export const POSTPONED_BADGE = { postponed: { label: "Postponed", tone: "warn" } }

// Attempt-log entries that close an attempt without an observation taking place.
const CLOSING = ["did_not_happen", "postponed"]

const list = (value) => (Array.isArray(value) ? value : [])
const attemptOf = (row) => Number(row?.attemptNo ?? 1)
const time = (value) => (value ? new Date(value).getTime() || 0 : 0)

// Everyone the detail names, so an observer known only by id still gets a name.
function teacherLookup(detail) {
  const people = new Map()
  const add = (person) => {
    if (person?.id != null && !people.has(person.id)) people.set(person.id, person)
  }
  list(detail.offers).forEach((offer) => add(offer.observer))
  list(detail.observations).forEach((observation) => add(observation.observer))
  list(detail.attempts).forEach((entry) => add(entry.observer))
  list(detail.candidates).forEach(add)
  list(detail.observerList).forEach(add)
  add(detail.offer?.observer)
  add(detail.pairing?.observer)
  return (id) => (id == null ? null : people.get(id) ?? { id, firstName: "Observer", lastName: `#${id}` })
}

function dateView(option, confirmedRequest) {
  return {
    id: option.id ?? `${option.proposedDate}-${option.startTime ?? ""}`,
    date: toDateOnly(option.proposedDate),
    startTime: option.startTime ?? null,
    endTime: option.endTime ?? null,
    timeRange: formatTimeRange(option.startTime, option.endTime),
    // Options can be shared between requests (dates are re-offered after a decline),
    // so the flag only counts on the request that was actually confirmed.
    isConfirmed: Boolean(confirmedRequest && option.isConfirmed),
  }
}

const sortDates = (dates) => dates.slice().sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))

// One request row. `kind` is "request" for a request the professor sent, or
// "assigned" / "attempt" for an attempt that has no request behind it (a committee
// assignment, or an attempt postponed before any request went out).
function makeRow(fields) {
  return {
    kind: "request",
    id: null,
    attemptNo: 1,
    observer: null,
    offerStatus: null,
    status: null,
    sentAt: null,
    expiresAt: null,
    respondedAt: null,
    reason: null,
    dates: [],
    confirmedDate: null,
    observationId: null,
    observationStatus: null,
    postponedAt: null,
    postponeReason: null,
    assignedByCommittee: false,
    ...fields,
  }
}

// Requests from the mock's `offers` (the full shape).
function fromOffers(detail, person) {
  return list(detail.offers).map((offer) => {
    const confirmed = offer.status === "confirmed"
    return makeRow({
      id: `offer-${offer.id}`,
      attemptNo: attemptOf(offer),
      observer: offer.observer ?? person(offer.observerId),
      offerStatus: offer.status,
      status: offer.status,
      sentAt: offer.sentAt ?? null,
      expiresAt: offer.expiresAt ?? null,
      respondedAt: offer.respondedAt ?? null,
      reason: offer.reason ?? null,
      dates: sortDates(list(offer.options).map((option) => dateView(option, confirmed))),
    })
  })
}

// Fallback for the real backend: rebuild requests from the time options. Options are
// grouped by attempt, then by the observer they were offered to. Options with no
// observer join the attempt's only request (the dates went out together); if the
// attempt has no observer at all, nothing was sent yet, so there is no request.
function fromTimeOptions(detail, person) {
  const attempts = new Map()
  for (const option of list(detail.timeOptions)) {
    const attemptNo = attemptOf(option)
    if (!attempts.has(attemptNo)) attempts.set(attemptNo, { byObserver: new Map(), loose: [] })
    const group = attempts.get(attemptNo)
    const observers = new Set(
      [option.offeredToTeacherId, ...list(option.offers).map((offer) => offer.teacherId)].filter(
        (id) => id != null,
      ),
    )
    if (observers.size === 0) group.loose.push(option)
    for (const id of observers) {
      if (!group.byObserver.has(id)) group.byObserver.set(id, [])
      group.byObserver.get(id).push(option)
    }
  }

  const latestAttempt = Math.max(0, ...attempts.keys())
  // Nothing says what happened to an older request, so it reads "Sent" (unknown
  // outcome) unless the sign-up is still waiting for a reply.
  const waiting = detail.status === "candidates_generated"
  const rows = []
  for (const [attemptNo, group] of attempts) {
    if (group.byObserver.size === 1) group.byObserver.values().next().value.push(...group.loose)
    for (const [observerId, options] of group.byObserver) {
      const confirmed = options.some(
        (option) => option.isConfirmed && (option.offeredToTeacherId ?? observerId) === observerId,
      )
      // Per-option offer rows (newer backend) can say what happened; otherwise only
      // "confirmed" is known for sure.
      const states = options.flatMap((option) =>
        list(option.offers).filter((offer) => offer.teacherId === observerId).map((offer) => offer.status),
      )
      const known = ["confirmed", "declined", "expired", "withdrawn", "pending"].find((key) =>
        states.includes(key),
      )
      const isCurrent = detail.offer?.observerId === observerId && attemptOf(detail.offer) === attemptNo
      const status = confirmed
        ? "confirmed"
        : known ?? (isCurrent || (waiting && attemptNo === latestAttempt) ? "pending" : "sent")
      rows.push(
        makeRow({
          id: `options-${attemptNo}-${observerId}`,
          attemptNo,
          observer: person(observerId),
          offerStatus: status,
          status,
          sentAt: isCurrent ? detail.offer.sentAt ?? null : null,
          expiresAt: isCurrent ? detail.offer.expiresAt ?? null : null,
          dates: sortDates(options.map((option) => dateView(option, confirmed))),
        }),
      )
    }
  }
  return rows
}

// The requests for one sign-up, newest attempt first (and newest request first
// inside an attempt). Never throws on a partial detail object.
export function buildRequests(detail) {
  if (!detail || typeof detail !== "object") return []
  const person = teacherLookup(detail)
  const rows = Array.isArray(detail.offers) ? fromOffers(detail, person) : fromTimeOptions(detail, person)

  const observations = list(detail.observations)
  const log = list(detail.attempts)
  const attemptNos = new Set([
    ...rows.map((row) => row.attemptNo),
    ...observations.map(attemptOf),
    ...log.filter((entry) => CLOSING.includes(entry.type)).map(attemptOf),
  ])

  for (const attemptNo of attemptNos) {
    const inAttempt = rows.filter((row) => row.attemptNo === attemptNo)
    const observation = observations.filter((item) => attemptOf(item) === attemptNo).at(-1) ?? null
    const closing = log.filter((entry) => attemptOf(entry) === attemptNo && CLOSING.includes(entry.type)).at(-1)
    const postponed = observation?.status === "postponed" || Boolean(closing)

    // The confirmed request carries the attempt's date and outcome.
    let target = inAttempt.find((row) => row.offerStatus === "confirmed") ?? null
    if (target && observation) {
      target.confirmedDate = toDateOnly(observation.scheduledDate) ?? target.confirmedDate
      target.observationId = observation.id ?? null
      target.observationStatus = observation.status ?? null
    }
    if (target && !target.confirmedDate) {
      target.confirmedDate = target.dates.find((date) => date.isConfirmed)?.date ?? null
    }

    // An observation with no confirmed request behind it was assigned by the committee.
    if (!target && observation) {
      target = makeRow({
        kind: "assigned",
        id: `observation-${observation.id ?? attemptNo}`,
        attemptNo,
        observer: observation.observer ?? person(observation.observerId),
        offerStatus: null,
        status: "confirmed",
        sentAt: observation.createdAt ?? null,
        confirmedDate: toDateOnly(observation.scheduledDate),
        observationId: observation.id ?? null,
        observationStatus: observation.status ?? null,
        assignedByCommittee:
          Boolean(observation.isAcStepin) ||
          log.some((entry) => attemptOf(entry) === attemptNo && entry.type === "ac_assigned"),
      })
      rows.push(target)
    }

    if (!postponed) continue
    // Postponed: the confirmed (or assigned) request, else the request the
    // postponement withdrew, else a row for the attempt itself, so it is never lost.
    if (!target) {
      const latest = inAttempt.slice().sort((a, b) => time(b.sentAt) - time(a.sentAt))[0]
      if (latest && ["withdrawn", "pending", "sent"].includes(latest.offerStatus)) target = latest
    }
    if (!target) {
      target = makeRow({
        kind: "attempt",
        id: `attempt-${attemptNo}`,
        attemptNo,
        observer: closing?.observer ?? null,
        sentAt: closing?.at ?? null,
      })
      rows.push(target)
    }
    target.status = "postponed"
    target.postponedAt = closing?.at ?? observation?.updatedAt ?? null
    target.postponeReason = closing?.reason ?? null
    target.observationStatus = observation?.status ?? target.observationStatus
  }

  return rows.sort(
    (a, b) => b.attemptNo - a.attemptNo || time(b.sentAt) - time(a.sentAt),
  )
}

// The filter group a request is counted in (null: only under "All").
export const requestGroup = (request) => GROUP[request.status] ?? null

// Counts per filter tab. `all` counts every request.
export function summarize(requests) {
  const counts = { all: 0, active: 0, confirmed: 0, declined: 0, expired: 0, postponed: 0 }
  for (const request of list(requests)) {
    counts.all += 1
    const group = requestGroup(request)
    if (group) counts[group] += 1
  }
  return counts
}

export const matchesFilter = (request, filter) => filter === "all" || requestGroup(request) === filter

// Course, term and section for a sign-up card, from the nested section or, on the
// real backend, the flat `courseCode` ("CS1337") and `sectionCode` ("CS1337.001").
export function signUpLabels(item) {
  const section = item?.section
  if (section?.course) {
    return {
      course: courseLabel(section.course),
      title: section.course.title ?? null,
      term: section.term ? formatTerm(section.term) : null,
      section: section.sectionNumber ? `Section ${section.sectionNumber}` : null,
    }
  }
  const [, subject, number] = /^([A-Za-z]+)\s*(\w+)$/.exec(item?.courseCode ?? "") ?? []
  const sectionNumber = item?.sectionCode?.split(".")[1]
  return {
    course: subject ? `${subject} ${number}` : item?.courseCode ?? "Unknown course",
    title: null,
    term: null,
    section: sectionNumber ? `Section ${sectionNumber}` : null,
  }
}
