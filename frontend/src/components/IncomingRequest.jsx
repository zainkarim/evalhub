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
import { Button, Callout, Card, ConfirmDialog, Input, Label } from "./ui"
import { useToast } from "./ui/toast-context"

// A colleague asked this professor to observe their class and offered several
// dates. Confirming exactly one date is final; nothing goes to the committee.
// Declining (reason optional) is recorded.
function IncomingRequest({ request, onChanged }) {
  const toast = useToast()
  const [optionId, setOptionId] = useState("")
  const [declining, setDeclining] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const pending = request.status === "pending"
  const confirmed = request.options.find((option) => option.isConfirmed)
  const chosen = request.options.find((option) => String(option.id) === String(optionId))

  const run = async (action, message) => {
    setBusy(true)
    setError("")
    try {
      await action()
      toast.success(message)
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <li>
      <Card className="text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              {fullName(request.observee)} asked you to observe{" "}
              <span className="text-primary-ink">{courseLabel(request.section.course)}</span>
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
          <fieldset className="mt-4">
            <legend className="font-medium">Choose one date that works for you</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {request.options.map((option) => {
                const past = option.proposedDate < todayISO()
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-card border border-line px-3 py-2.5 tabular-nums has-[:checked]:border-primary-ink has-[:checked]:bg-surface-2 ${
                      past ? "cursor-not-allowed opacity-50" : "hover:border-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`option-${request.id}`}
                      value={option.id}
                      checked={String(optionId) === String(option.id)}
                      disabled={past}
                      onChange={() => setOptionId(option.id)}
                      className="h-4 w-4 accent-primary-ink"
                    />
                    <span>
                      {formatDate(option.proposedDate)} ·{" "}
                      {formatTimeRange(option.startTime, option.endTime)}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              Confirming one date makes the pairing final. Course schedules were checked; your own
              calendar was not.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button disabled={!optionId || busy} loading={busy} onClick={() => setConfirming(true)}>
                {busy ? "Confirming…" : "Confirm this date"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setDeclining(true)}>
                Decline…
              </Button>
            </div>
          </fieldset>
        )}

        {pending && declining && (
          <div className="mt-4 rounded-card border border-line bg-surface-2 p-4">
            <Label htmlFor={`decline-${request.id}`}>Reason (optional)</Label>
            <Input
              id={`decline-${request.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2"
              placeholder="None of the dates work"
            />
            <p className="mt-2 text-xs text-muted">
              Your colleague is told and can ask someone else. The reply is kept on the record.
            </p>
            <div className="mt-3 flex gap-3">
              <Button
                variant="danger"
                disabled={busy}
                loading={busy}
                onClick={() =>
                  run(() => api.declineRequest(request.assessmentId, reason.trim()), "Request declined.")
                }
              >
                {busy ? "Declining…" : "Decline request"}
              </Button>
              <Button variant="ghost" onClick={() => setDeclining(false)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {request.status === "confirmed" && confirmed && (
          <p className="mt-2 text-xs text-muted">
            You confirmed {formatDate(confirmed.proposedDate)}. See{" "}
            <Link to="/observations" className="text-primary-ink hover:underline">
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
          <Callout tone="danger" role="alert" className="mt-3">
            {error}
          </Callout>
        )}
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Confirm this date?"
        description={
          chosen
            ? `${formatDate(chosen.proposedDate)} · ${formatTimeRange(chosen.startTime, chosen.endTime)}. Confirming one date makes the pairing final.`
            : "Confirming one date makes the pairing final."
        }
        confirmLabel="Confirm this date"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          run(() => api.confirmTimeOption(optionId), "Date confirmed.")
        }}
      />
    </li>
  )
}

export default IncomingRequest
