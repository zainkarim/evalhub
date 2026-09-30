import { useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../lib/api"
import {
  courseLabel,
  formatDate,
  formatDateTime,
  formatMeeting,
  formatTerm,
  fullName,
  meetingDates,
  timeLeft,
} from "../lib/format"
import { REQUEST_STATUS } from "../lib/format"
import StatusBadge from "./StatusBadge"

// A colleague asked this professor to observe their class. Accepting records
// the pairing and the class date; the committee still approves it afterwards.
function IncomingRequest({ request, onChanged }) {
  const [choosing, setChoosing] = useState(false)
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const dates = meetingDates(request.section)
  const pending = request.status === "pending"

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
            Sent {formatDateTime(request.requestedAt)}
            {pending ? ` · ${timeLeft(request.expiresAt)}` : ""}
          </p>
        </div>
        <StatusBadge status={request.status} map={REQUEST_STATUS} />
      </div>

      {pending && !choosing && (
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="rounded bg-utd-green px-3 py-1.5 font-medium text-white hover:bg-utd-green-dark"
          >
            Accept…
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => api.declineRequest(request.id))}
            className="rounded border border-line px-3 py-1.5 hover:border-ink disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}

      {pending && choosing && (
        <div className="mt-3 rounded border border-line bg-canvas p-4">
          <label htmlFor={`date-${request.id}`} className="block text-sm font-medium">
            Which class meeting will you attend?
          </label>
          <select
            id={`date-${request.id}`}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 w-full max-w-xs rounded border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a date</option>
            {dates.map((value) => (
              <option key={value} value={value}>
                {formatDate(value)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted">
            Accepting cancels the other requests your colleague sent. The committee reviews
            the pairing before it is final.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={!date || busy}
              onClick={() => run(() => api.acceptRequest(request.id, date))}
              className="rounded bg-utd-green px-3 py-1.5 font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
            >
              {busy ? "Accepting…" : "Confirm & accept"}
            </button>
            <button
              type="button"
              onClick={() => setChoosing(false)}
              className="rounded border border-line px-3 py-1.5 hover:border-ink"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {request.status === "accepted" && (
        <p className="mt-2 text-xs text-muted">
          You accepted on {formatDateTime(request.respondedAt)}. See{" "}
          <Link to="/observations" className="text-utd-green hover:underline">
            Observations I&apos;m giving
          </Link>{" "}
          for the approval status.
        </p>
      )}
      {request.status === "cancelled" && (
        <p className="mt-2 text-xs text-muted">
          Cancelled — another observer accepted or the request was withdrawn.
        </p>
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
