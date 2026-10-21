import { useState } from "react"
import { api } from "../lib/api"
import {
  formatDate,
  formatRank,
  formatTimeRange,
  fullName,
  meetingDates,
  OFFER_STATUS,
  timeLeft,
  toDateOnly,
  todayISO,
} from "../lib/format"
import StatusBadge from "./StatusBadge"

const MIN_DATES = 4
const MAX_DATES = 8
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

const shortDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

// A numbered step that turns into a check mark once it is done (same marker
// as the observation form).
function StepTitle({ number, done, children }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done ? "bg-utd-green text-white" : "border border-line text-muted"
        }`}
      >
        {done ? "✓" : number}
      </span>
      {children}
    </h3>
  )
}

// The professor's step (requirements §4.3 step 4): choose ONE observer from the
// list and offer roughly 4-8 possible class dates. Nothing is sent until the
// dates are chosen; then a single request goes to that one observer, who
// confirms exactly one date.
//
// #59: Quick Pick and Calendar offer exactly the same dates, the section's
// class meetings from today through the semester's observation deadline (or the
// end of term when no deadline is set), and Send stays disabled unless every
// chosen date is one of them.
function RequestPanel({ assessment, onChanged }) {
  const [observerId, setObserverId] = useState("")
  const [dates, setDates] = useState([])
  const [dateView, setDateView] = useState("calendar")
  // Open the calendar on the first selectable class date, not today's month.
  const [calendarMonth, setCalendarMonth] = useState(() =>
    (meetingDates(assessment.section, { limit: 1 })[0] ?? todayISO()).slice(0, 7),
  )
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const { candidates, offer, section, status } = assessment
  const sectionHasTimes = Boolean(section.startTime && section.endTime)
  const classDates = meetingDates(section, { limit: 60 })
  const observationDeadline = toDateOnly(section.term?.observationDeadline)
  const termEnd = toDateOnly(section.term?.endDate)
  const firstMonth = classDates[0]?.slice(0, 7)
  const lastMonth = (observationDeadline ?? classDates[classDates.length - 1])?.slice(0, 7)
  const today = todayISO()
  const nextAttempt = status === "postponed"

  const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number)
  const firstDay = new Date(calendarYear, calendarMonthNumber - 1, 1)
  const daysInMonth = new Date(calendarYear, calendarMonthNumber, 0).getDate()
  const calendarDays = [
    ...Array(firstDay.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${calendarMonth}-${String(index + 1).padStart(2, "0")}`),
  ]
  const moveMonth = (delta) =>
    setCalendarMonth(monthKey(new Date(calendarYear, calendarMonthNumber - 1 + delta, 1)))

  const run = async (action) => {
    setBusy(true)
    setError("")
    try {
      await action()
      setObserverId("")
      setDates([])
      setReason("")
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const quickPick = (count) => setDates(classDates.slice(0, count))
  const toggle = (value) =>
    setDates((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length >= MAX_DATES
          ? current
          : [...current, value],
    )

  const from = sectionHasTimes ? section.startTime : startTime
  const to = sectionHasTimes ? section.endTime : endTime
  const timesOk = Boolean(from && to && to > from)
  const datesValid =
    dates.length >= MIN_DATES &&
    dates.length <= MAX_DATES &&
    dates.every((date) => classDates.includes(date))
  const ready = Boolean(observerId) && datesValid && timesOk
  const chosenObserver = candidates.find((candidate) => String(candidate.id) === observerId)

  const send = () => {
    if (!ready || busy) return
    return run(async () => {
      await api.addTimeOptions(
        assessment.id,
        dates.map((proposedDate) => ({ proposedDate, startTime: from, endTime: to })),
      )
      await api.sendRequest(assessment.id, Number(observerId))
    })
  }

  if (candidates.length === 0) return null

  const tab = (value, label) => (
    <button
      type="button"
      onClick={() => setDateView(value)}
      aria-pressed={dateView === value}
      className={`px-4 py-1.5 text-sm ${
        dateView === value ? "bg-utd-green-dark font-medium text-white" : "bg-white text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  )

  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-6 shadow-xs">
      <h2 className="text-base font-semibold">
        {nextAttempt ? "Schedule a new attempt" : "Ask one observer"}
      </h2>

      {offer ? (
        <div className="mt-3 text-sm">
          <p>
            Your request is with <span className="font-medium">{fullName(offer.observer)}</span>.{" "}
            <StatusBadge status={offer.status} map={OFFER_STATUS} />
          </p>
          <p className="mt-1 text-muted">
            They confirm one of the dates below. If there is no reply, the request expires in{" "}
            {timeLeft(offer.expiresAt).replace(" left", "")} and you can ask someone else.
          </p>
          <ul className="mt-3 list-disc pl-5">
            {offer.options.map((option) => (
              <li key={option.id}>
                {formatDate(option.proposedDate)} · {formatTimeRange(option.startTime, option.endTime)}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-md border border-line bg-canvas p-4">
            <label htmlFor="withdraw-reason" className="block text-sm font-medium">
              Ask someone else instead? (reason optional)
            </label>
            <input
              id="withdraw-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              placeholder="Why you are withdrawing this request"
            />
            <p className="mt-2 text-xs text-muted">
              Withdrawing is recorded in the attempt history; nothing is deleted.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.withdrawRequest(assessment.id, reason.trim()))}
              className="mt-3 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-ink disabled:opacity-60"
            >
              Withdraw request
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1 text-sm">
          <p className="text-muted">
            {nextAttempt
              ? "The last attempt is on the record. Pick an observer and new dates in the same semester."
              : "Pick one person from your list and offer 4–8 of your class dates. Nothing is sent until you press Send; the observer confirms one date."}
          </p>

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
            {/* Step 1: observer (and class time when the schedule doesn't list one) */}
            <div>
              <StepTitle number={1} done={Boolean(observerId) && timesOk}>
                Choose the observer
              </StepTitle>
              <label htmlFor="observer" className="mt-3 block text-xs text-muted">
                From your candidate list
              </label>
              <select
                id="observer"
                value={observerId}
                onChange={(event) => setObserverId(event.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              >
                <option value="">Select one observer</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {fullName(candidate)} · {formatRank(candidate.rank)}
                  </option>
                ))}
              </select>

              {sectionHasTimes ? (
                <p className="mt-3 text-xs text-muted">
                  Class time: {formatTimeRange(section.startTime, section.endTime)}. Course
                  schedules are checked for you; personal calendars are not, which is why the
                  observer gets several dates to choose from.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-4">
                  <div>
                    <label htmlFor="start-time" className="block text-xs text-muted">
                      Class starts
                    </label>
                    <input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className="mt-1 rounded-md border border-line bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-time" className="block text-xs text-muted">
                      Class ends
                    </label>
                    <input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="mt-1 rounded-md border border-line bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: dates */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StepTitle number={2} done={datesValid}>
                  Offer 4–8 class dates
                </StepTitle>
                <div className="inline-flex overflow-hidden rounded-md border border-line">
                  {tab("calendar", "Calendar")}
                  {tab("quick", "Quick Pick")}
                </div>
              </div>

              <p className="mt-2 text-xs text-muted">
                {observationDeadline ? (
                  <>
                    Observation deadline{" "}
                    <span className="font-medium text-utd-orange">{formatDate(observationDeadline)}</span>
                    . Later dates can&apos;t be offered.
                  </>
                ) : (
                  "No observation deadline is set for this semester yet, so dates run to the end of the term."
                )}
              </p>

              {classDates.length === 0 ? (
                <p className="mt-4 rounded-md border border-line bg-canvas px-4 py-5 text-muted">
                  No class meetings are left before the observation deadline.
                </p>
              ) : dateView === "quick" ? (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {[4, 6, 8].map((count) => (
                      <button
                        key={count}
                        type="button"
                        disabled={classDates.length < count}
                        onClick={() => quickPick(count)}
                        className="rounded-md border border-line bg-white px-3 py-1.5 hover:border-utd-green-dark disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next {count} classes
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid max-h-64 grid-cols-2 gap-x-6 gap-y-1.5 overflow-y-auto rounded-md border border-line bg-canvas p-3 sm:grid-cols-3">
                    {classDates.map((value) => {
                      const checked = dates.includes(value)
                      return (
                        <label key={value} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && dates.length >= MAX_DATES}
                            onChange={() => toggle(value)}
                          />
                          {shortDate(value)}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-line p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => moveMonth(-1)}
                      disabled={!firstMonth || calendarMonth <= firstMonth}
                      className="rounded-md border border-line px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous month"
                    >
                      ←
                    </button>
                    <p className="font-semibold" aria-live="polite">
                      {firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                    <button
                      type="button"
                      onClick={() => moveMonth(1)}
                      disabled={!lastMonth || calendarMonth >= lastMonth}
                      className="rounded-md border border-line px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next month"
                    >
                      →
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {WEEKDAYS.map((day) => (
                      <div key={day} className="py-1 text-xs font-medium text-muted">
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((day, index) => {
                      if (!day) return <div key={`empty-${index}`} />
                      const eligible = classDates.includes(day)
                      const selected = dates.includes(day)
                      const isDeadline = day === observationDeadline
                      const pastDeadline =
                        observationDeadline && day > observationDeadline && (!termEnd || day <= termEnd)
                      const disabled = !eligible || (!selected && dates.length >= MAX_DATES)
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={disabled}
                          aria-pressed={selected}
                          aria-label={`${shortDate(day)}${eligible ? "" : ", not available"}${
                            isDeadline ? ", observation deadline" : ""
                          }`}
                          title={
                            pastDeadline
                              ? "After the observation deadline"
                              : eligible
                                ? undefined
                                : "No class meeting"
                          }
                          onClick={() => toggle(day)}
                          className={`relative flex h-11 flex-col items-center justify-center rounded-md text-sm ${
                            selected
                              ? "bg-utd-green-dark font-semibold text-white"
                              : eligible
                                ? "border border-utd-green/40 bg-white font-medium hover:bg-utd-green/10"
                                : pastDeadline
                                  ? "bg-canvas text-muted/50 line-through"
                                  : "text-muted/50"
                          } ${day === today && !selected ? "underline underline-offset-4" : ""} ${
                            isDeadline ? "ring-1 ring-utd-orange ring-inset" : ""
                          } disabled:cursor-not-allowed`}
                        >
                          {Number(day.slice(-2))}
                          {isDeadline && (
                            <span
                              className={`hidden text-[9px] leading-none font-medium sm:block ${
                                selected ? "text-white" : "text-utd-orange"
                              }`}
                            >
                              deadline
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm border border-utd-green/40 bg-white" /> Class meeting
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-utd-green-dark" /> Offered
                    </span>
                    {observationDeadline && (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm ring-1 ring-utd-orange ring-inset" /> Deadline
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: review and send */}
          <div className="mt-8 border-t border-line pt-5">
            <StepTitle number={3} done={false}>
              Send the request
            </StepTitle>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className={datesValid ? "text-utd-green-dark" : "text-muted"}>
                  {chosenObserver ? fullName(chosenObserver) : "No observer chosen"},{" "}
                  {dates.length} of {MIN_DATES}–{MAX_DATES} dates
                  {dates.length > 0 && dates.length < MIN_DATES
                    ? ` (pick ${MIN_DATES - dates.length} more)`
                    : ""}
                </p>
                {dates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...dates].sort().map((date) => (
                      <button
                        key={date}
                        type="button"
                        onClick={() => toggle(date)}
                        className="rounded-full border border-utd-green-dark bg-white px-3 py-1 text-xs hover:bg-canvas"
                        aria-label={`Remove ${shortDate(date)}`}
                        title="Remove this date"
                      >
                        {shortDate(date)} ×
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDates([])}
                      className="px-1 text-xs font-medium text-utd-green-dark hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!ready || busy}
                onClick={send}
                className="w-full shrink-0 rounded-md bg-utd-green px-5 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {busy ? "Sending…" : "Send request"}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              One request goes to one observer and expires after 48 hours without a reply. The
              pairing is final once they confirm a date.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-utd-orange/40 bg-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}

export default RequestPanel
