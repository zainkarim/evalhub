import { useState } from "react"
import { Button, Callout, ConfirmDialog, Label, Textarea } from "./ui"
import { useToast } from "./ui/toast-context"

// Replaces cancel / "it didn't happen" / reschedule. Nothing is cancelled or
// deleted: the attempt is marked Postponed with who, when and why on the record,
// and a new attempt can be scheduled afterwards (same semester where possible).
// The final button asks once more, because the postponement goes on the record.
function PostponeControl({ label = "Postpone this attempt", prompt, onSubmit, onDone }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
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
      toast.success("Attempt postponed and recorded.")
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
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {label}…
        </Button>
      ) : (
        <div className="rounded-card border border-line bg-surface-2 p-4">
          <Label htmlFor="postpone-reason">{prompt ?? "Why is this being postponed?"}</Label>
          <Textarea
            id="postpone-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-2"
            placeholder="Illness, a schedule conflict…"
          />
          <p className="mt-2 text-xs text-muted">
            This is recorded with your name and the time. The sign-up is marked Postponed and a
            new attempt can be scheduled.
          </p>
          <div className="mt-3 flex gap-3">
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={busy}
              onClick={() => setConfirming(true)}
            >
              {busy ? "Saving…" : "Postpone and record"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
      {error && (
        <Callout tone="danger" role="alert" className="mt-3">
          {error}
        </Callout>
      )}

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title="Postpone this attempt?"
        description="It is marked Postponed and recorded with your name, the time and the reason. Nothing is deleted, and a new attempt can be scheduled."
        confirmLabel="Postpone and record"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          submit()
        }}
      />
    </div>
  )
}

export default PostponeControl
