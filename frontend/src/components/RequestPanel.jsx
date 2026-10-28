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
import DatePicker from "./DatePicker"
import StatusBadge from "./StatusBadge"
import { Button, Callout, Card, Input, Label, Select } from "./ui"
import { useToast } from "./ui/toast-context"

const MIN_DATES = 4
const MAX_DATES = 8

// A numbered step that turns into a check mark once it is done (same marker
// as the observation form).
function StepTitle({ number, done, children }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done ? "bg-primary text-primary-fg" : "border border-line text-muted"
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
  const toast = useToast()
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
  const observationDeadline = toDateOnly(section.term?.observationDeadline)
  const termEnd = toDateOnly(section.term?.endDate)
  const today = todayISO()
  const nextAttempt = status === "postponed"

  const run = async (action, message) => {
    setBusy(true)
    setError("")
    try {
      await action()
      if (message) toast.success(message)
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
    }, "Request sent.")
  }

  if (candidates.length === 0) return null

  return (
    <Card as="section" className="mt-6">
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
          <div className="mt-4 rounded-card border border-line bg-surface-2 p-4">
            <Label htmlFor="withdraw-reason">Ask someone else instead? (reason optional)</Label>
            <Input
              id="withdraw-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2"
              placeholder="Why you are withdrawing this request"
            />
            <p className="mt-2 text-xs text-muted">
              Withdrawing is recorded in the attempt history; nothing is deleted.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={busy}
              onClick={() => run(() => api.withdrawRequest(assessment.id, reason.trim()), "Request withdrawn.")}
            >
              Withdraw request
            </Button>
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
              <Label htmlFor="observer" className="mt-3 text-xs font-normal text-muted">
                From your candidate list
              </Label>
              <Select
                id="observer"
                value={observerId}
                onChange={(event) => setObserverId(event.target.value)}
                className="mt-1"
              >
                <option value="">Select one observer</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {fullName(candidate)} · {formatRank(candidate.rank)}
                  </option>
                ))}
              </Select>

              {sectionHasTimes ? (
                <p className="mt-3 text-xs text-muted">
                  Class time: {formatTimeRange(section.startTime, section.endTime)}. Course
                  schedules are checked for you; personal calendars are not, which is why the
                  observer gets several dates to choose from.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-4">
                  <div>
                    <Label htmlFor="start-time" className="text-xs font-normal text-muted">
                      Class starts
                    </Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className="mt-1 w-auto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time" className="text-xs font-normal text-muted">
                      Class ends
                    </Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="mt-1 w-auto"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: dates (calendar or list, chosen dates as chips) */}
            <DatePicker
              heading={
                <StepTitle number={2} done={datesValid}>
                  Offer 4–8 class dates
                </StepTitle>
              }
              classDates={classDates}
              dates={dates}
              onToggle={toggle}
              onQuickPick={quickPick}
              onClear={() => setDates([])}
              minDates={MIN_DATES}
              maxDates={MAX_DATES}
              deadline={observationDeadline}
              termEnd={termEnd}
              today={today}
            />
          </div>

          {/* Step 3: review and send */}
          <div className="mt-8 border-t border-line pt-5">
            <StepTitle number={3} done={false}>
              Send the request
            </StepTitle>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className={datesValid ? "text-success" : "text-muted"}>
                  {chosenObserver ? fullName(chosenObserver) : "No observer chosen"},{" "}
                  {dates.length} of {MIN_DATES}–{MAX_DATES} dates
                  {dates.length > 0 && dates.length < MIN_DATES
                    ? ` (pick ${MIN_DATES - dates.length} more)`
                    : ""}
                </p>
              </div>
              <Button disabled={!ready} loading={busy} onClick={send} className="w-full shrink-0 sm:w-auto">
                {busy ? "Sending…" : "Send request"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              One request goes to one observer and expires after 48 hours without a reply. The
              pairing is final once they confirm a date.
            </p>
          </div>
        </div>
      )}

      {error && (
        <Callout tone="danger" role="alert" className="mt-3">
          {error}
        </Callout>
      )}
    </Card>
  )
}

export default RequestPanel
