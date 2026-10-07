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
} from "../lib/format"
import StatusBadge from "./StatusBadge"

const MIN_DATES = 4
const MAX_DATES = 8

// The professor's step (requirements §4.3 step 4): choose ONE observer from the
// list and offer roughly 4-8 possible class dates. Nothing is sent until the
// dates are chosen; then a single request goes to that one observer, who
// confirms exactly one date.
function RequestPanel({ assessment, onChanged }) {
  const [observerId, setObserverId] = useState("")
  const [dates, setDates] = useState([])
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const { candidates, offer, section, status } = assessment
  const sectionHasTimes = Boolean(section.startTime && section.endTime)
  const classDates = meetingDates(section, { limit: 60 })
  const nextAttempt = status === "postponed"

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

  const toggle = (value) =>
    setDates((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )

  const from = sectionHasTimes ? section.startTime : startTime
  const to = sectionHasTimes ? section.endTime : endTime
  const timesOk = Boolean(from && to && to > from)
  const ready = Boolean(observerId) && dates.length >= MIN_DATES && dates.length <= MAX_DATES && timesOk

  const send = () =>
    run(async () => {
      await api.addTimeOptions(
        assessment.id,
        dates.map((proposedDate) => ({ proposedDate, startTime: from, endTime: to })),
      )
      await api.sendRequest(assessment.id, Number(observerId))
    })

  if (candidates.length === 0) return null

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">
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
          <div className="mt-4 rounded border border-line bg-canvas p-4">
            <label htmlFor="withdraw-reason" className="block text-sm font-medium">
              Ask someone else instead? (reason optional)
            </label>
            <input
              id="withdraw-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 w-full rounded border border-line bg-white px-3 py-2 text-sm"
              placeholder="Why you are withdrawing this request"
            />
            <p className="mt-2 text-xs text-muted">
              Withdrawing is recorded in the attempt history; nothing is deleted.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.withdrawRequest(assessment.id, reason.trim()))}
              className="mt-3 rounded border border-line bg-white px-3 py-1.5 text-sm hover:border-ink disabled:opacity-60"
            >
              Withdraw request
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm">
          <p className="text-muted">
            {nextAttempt
              ? "The last attempt is on the record. Pick an observer and new dates in the same semester."
              : "Pick one person from your list, then offer 4–8 class dates. Nothing is sent until you choose the dates. The observer confirms one."}
          </p>

          <label htmlFor="observer" className="mt-4 block text-sm font-medium">
            Observer
          </label>
          <select
            id="observer"
            value={observerId}
            onChange={(event) => setObserverId(event.target.value)}
            className="mt-2 w-full max-w-sm rounded border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select one observer</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {fullName(candidate)} · {formatRank(candidate.rank)}
              </option>
            ))}
          </select>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium">
              Possible dates{" "}
              <span className={dates.length >= MIN_DATES ? "text-utd-green-dark" : "text-muted"}>
                ({dates.length} of {MIN_DATES}–{MAX_DATES} chosen)
              </span>
            </legend>
            {classDates.length === 0 ? (
              <p className="mt-2 text-muted">No upcoming class meetings are left this term.</p>
            ) : (
              <div className="mt-2 grid max-h-64 grid-cols-2 gap-x-6 gap-y-1 overflow-y-auto rounded border border-line bg-canvas p-3 sm:grid-cols-3">
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
                      {formatDate(value)}
                    </label>
                  )
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              These are meetings of your class
              {sectionHasTimes ? ` (${formatTimeRange(section.startTime, section.endTime)})` : ""}.
              Course schedules are checked for you; personal calendars are not, which is why the
              observer gets several dates to choose from.
            </p>
          </fieldset>

          {!sectionHasTimes && (
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
                  className="mt-1 rounded border border-line bg-white px-3 py-2 text-sm"
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
                  className="mt-1 rounded border border-line bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!ready || busy}
            onClick={send}
            className="mt-5 rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
          <p className="mt-2 text-xs text-muted">
            One request goes to one observer and expires after 48 hours without a reply. The
            pairing is final once they confirm a date.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}

export default RequestPanel
