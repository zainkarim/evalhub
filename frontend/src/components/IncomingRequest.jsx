import { useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../lib/api"
import {
  courseLabel,
  formatDate,
  formatDateTime,
  formatMeeting,
  formatTerm,
  formatTimeRange,
  fullName,
  OFFER_STATUS,
  timeLeft,
  todayISO,
} from "../lib/format"
import StatusBadge from "./StatusBadge"

// A colleague asked this professor to observe their class and offered several
// dates. Confirming exactly one date makes the pairing final — there is no
// committee approval afterwards. Declining (reason optional) is recorded.
function IncomingRequest({ request, onChanged }) {
  const [optionId, setOptionId] = useState("")
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const pending = request.status === "pending"
  const confirmed = request.options.find((option) => option.isConfirmed)

  const run = async (action) => {
    setBusy(true)
    setError("")
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <li className="px-5 py-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {fullName(request.observee)} asked you to observe{" "}
            <span className="text-utd-green">{courseLabel(request.section.course)}</span>
          </p>
          <p className="mt-0.5 text-muted">
            {request.section.course.title} · Section {request.section.sectionNumber} ·{" "}
            {formatTerm(request.section.term)}
          </p>
          <p className="text-muted">{formatMeeting(request.section)}</p>
          <p className="mt-1 text-xs text-muted">
            Sent {formatDateTime(request.sentAt)}
            {pending ? ` · expires in ${timeLeft(request.expiresAt).replace(" left", "")}` : ""}
          </p>
        </div>
        <StatusBadge status={request.status} map={OFFER_STATUS} />
      </div>

      {pending && !declining && (
        <div className="mt-3">
          <p className="font-medium">Choose one date that works for you</p>
          <div className="mt-2 space-y-1">
            {request.options.map((option) => (
              <label key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`option-${request.id}`}
                  value={option.id}
                  checked={String(optionId) === String(option.id)}
                  disabled={option.proposedDate < todayISO()}
                  onChange={() => setOptionId(option.id)}
                />
                {formatDate(option.proposedDate)} ·{" "}
                {formatTimeRange(option.startTime, option.endTime)}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Confirming one date makes the pairing final. Course schedules were checked; your own
            calendar was not.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={!optionId || busy}
              onClick={() => run(() => api.confirmTimeOption(optionId))}
              className="rounded bg-utd-green px-3 py-1.5 font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Confirm this date"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeclining(true)}
              className="rounded border border-line px-3 py-1.5 hover:border-ink disabled:opacity-60"
            >
              Decline…
            </button>
          </div>
        </div>
      )}

      {pending && declining && (
        <div className="mt-3 rounded border border-line bg-canvas p-4">
          <label htmlFor={`decline-${request.id}`} className="block text-sm font-medium">
            Reason (optional)
          </label>
          <input
            id={`decline-${request.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 w-full rounded border border-line bg-white px-3 py-2 text-sm"
            placeholder="None of the dates work"
          />
          <p className="mt-2 text-xs text-muted">
            Your colleague is told and can ask someone else. The reply is kept on the record.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.declineRequest(request.assessmentId, reason.trim()))}
              className="rounded bg-utd-orange px-3 py-1.5 font-medium text-white disabled:opacity-60"
            >
              {busy ? "Declining…" : "Decline request"}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className="rounded border border-line px-3 py-1.5 hover:border-ink"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {request.status === "confirmed" && confirmed && (
        <p className="mt-2 text-xs text-muted">
          You confirmed {formatDate(confirmed.proposedDate)}. See{" "}
          <Link to="/observations" className="text-utd-green hover:underline">
            Observations I&apos;m giving
          </Link>
          .
        </p>
      )}
      {request.status === "declined" && (
        <p className="mt-2 text-xs text-muted">
          You declined{request.reason ? `: ${request.reason}` : "."}
        </p>
      )}
      {request.status === "expired" && (
        <p className="mt-2 text-xs text-muted">
          No reply within 48 hours, so the request expired. It is kept on the record.
        </p>
      )}
      {request.status === "withdrawn" && (
        <p className="mt-2 text-xs text-muted">Withdrawn by the professor.</p>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded border border-utd-orange/40 bg-white px-3 py-2">
          {error}
        </p>
      )}
    </li>
  )
}

export default IncomingRequest
