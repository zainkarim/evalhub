import { useState } from "react"
import { api } from "../lib/api"

// The committee's approval gate. A pairing is only official once it's approved
// here; rejecting sends the professor back to choosing an observer.
function ReviewControls({ observation, user, onDone }) {
  const [rejecting, setRejecting] = useState(false)
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Nobody approves a pairing they are part of (they'd be approving themselves).
  const conflicted = [observation.observer.id, observation.observee.id].includes(
    user?.teacherId,
  )

  const decide = async (decision) => {
    setBusy(true)
    setError("")
    try {
      await api.reviewObservation(observation.id, decision, notes.trim() || undefined)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (conflicted) {
    return (
      <p className="rounded border border-line bg-canvas px-4 py-3 text-sm text-muted">
        You&apos;re part of this pairing, so another committee member has to review it.
      </p>
    )
  }

  return (
    <div>
      {!rejecting ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide("approved")}
            className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-60"
          >
            {busy ? "Saving…" : "Approve pairing"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="rounded border border-line px-4 py-2 text-sm hover:border-ink"
          >
            Reject…
          </button>
        </div>
      ) : (
        <div className="rounded border border-line bg-canvas p-4">
          <label htmlFor={`notes-${observation.id}`} className="block text-sm font-medium">
            Why is this pairing being rejected?
          </label>
          <textarea
            id={`notes-${observation.id}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded border border-line bg-white px-3 py-2 text-sm"
            placeholder="The professor will pick a different observer."
          />
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy || !notes.trim()}
              onClick={() => decide("rejected")}
              className="rounded bg-utd-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Reject pairing"}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded border border-line px-4 py-2 text-sm hover:border-ink"
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

export default ReviewControls
