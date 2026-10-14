import { useState } from "react"

// Replaces cancel / "it didn't happen" / reschedule. Nothing is cancelled or
// deleted: the attempt is marked Postponed with who, when and why on the record,
// and a new attempt can be scheduled afterwards (same semester where possible).
function PostponeControl({ label = "Postpone this attempt", prompt, onSubmit, onDone }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    setBusy(true)
    setError("")
    try {
      await onSubmit(reason.trim())
      setOpen(false)
      setReason("")
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink"
        >
          {label}…
        </button>
      ) : (
        <div className="rounded border border-line bg-canvas p-4">
          <label htmlFor="postpone-reason" className="block text-sm font-medium">
            {prompt ?? "Why is this being postponed?"}
          </label>
          <textarea
            id="postpone-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded border border-line bg-white px-3 py-2 text-sm"
            placeholder="Illness, a schedule conflict…"
          />
          <p className="mt-2 text-xs text-muted">
            This is recorded with your name and the time. The sign-up is marked Postponed and a
            new attempt can be scheduled.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={!reason.trim() || busy}
              onClick={submit}
              className="rounded bg-utd-orange px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Postpone and record"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink"
            >
              Back
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

export default PostponeControl
