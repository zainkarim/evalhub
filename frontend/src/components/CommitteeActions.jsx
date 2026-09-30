import { useCallback, useState } from "react"
import { api } from "../lib/api"
import { formatDate, fullName, meetingDates } from "../lib/format"
import { useApi } from "../lib/useApi"
import ReviewControls from "./ReviewControls"

function AssignObserver({ assessment, onChanged }) {
  const call = useCallback(() => api.stepInOptions(assessment.id), [assessment.id])
  const { data: options } = useApi(call)
  const [observerId, setObserverId] = useState("")
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const listed = assessment.candidates.map((candidate) => candidate.id)
  const stepIn = (options?.data ?? []).filter((member) => !listed.includes(member.id))
  const dates = meetingDates(assessment.section)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const fromList = listed.includes(Number(observerId))
      await api.assignObserver(assessment.id, {
        observerId: Number(observerId),
        candidateListId: fromList ? assessment.candidateList.id : undefined,
        scheduledDate: date,
      })
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h3 className="text-sm font-medium">Assign an observer</h3>
      <p className="mt-1 text-sm text-muted">
        Use this when no candidate is eligible or no one accepts: a committee member steps in
        as observer. Another committee member still has to approve the pairing.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="assign-observer" className="block text-xs text-muted">
            Observer
          </label>
          <select
            id="assign-observer"
            value={observerId}
            onChange={(event) => setObserverId(event.target.value)}
            className="mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select observer</option>
            {assessment.candidates.length > 0 && (
              <optgroup label="From the candidate list">
                {assessment.candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {fullName(candidate)}
                  </option>
                ))}
              </optgroup>
            )}
            {stepIn.length > 0 && (
              <optgroup label="Committee members (step-in)">
                {stepIn.map((member) => (
                  <option key={member.id} value={member.id}>
                    {fullName(member)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="assign-date" className="block text-xs text-muted">
            Class date to observe
          </label>
          <select
            id="assign-date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a date</option>
            {dates.map((value) => (
              <option key={value} value={value}>
                {formatDate(value)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={!observerId || !date || busy}
        className="mt-3 rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
      >
        {busy ? "Assigning…" : "Assign observer"}
      </button>
      {error && (
        <p role="alert" className="mt-3 rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </form>
  )
}

// Committee-only controls on a sign-up: approve/reject the proposed pairing,
// step in as observer, postpone, or cancel.
function CommitteeActions({ assessment, user, onChanged }) {
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const { status, pairing } = assessment
  const awaitingReview = status === "pending_ac_approval" && pairing?.status === "proposed"
  const canAssign = ["signed_up", "candidates_generated"].includes(status)
  const terminal = ["completed", "cancelled", "postponed", "not_eligible"].includes(status)

  const run = async (action) => {
    setBusy(true)
    setError("")
    try {
      await action()
      setConfirming(null)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!awaitingReview && !canAssign && terminal) return null

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">Committee actions</h2>

      {awaitingReview && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Review the proposed pairing</h3>
          <p className="mt-1 mb-3 text-sm text-muted">
            Nothing is treated as final — and no one is told it is — until the committee
            approves.
          </p>
          <ReviewControls observation={pairing} user={user} onDone={onChanged} />
        </div>
      )}

      {canAssign && (
        <div className="mt-4">
          <AssignObserver assessment={assessment} onChanged={onChanged} />
        </div>
      )}

      {!terminal && (
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="text-sm font-medium">Can&apos;t go ahead this semester?</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {[
              { id: "postpone", label: "Postpone to next semester", run: () => api.postponeAssessment(assessment.id) },
              { id: "cancel", label: "Cancel sign-up", run: () => api.cancelAssessment(assessment.id, { reason: "other" }) },
            ].map((item) =>
              confirming === item.id ? (
                <span key={item.id} className="flex items-center gap-2 text-sm">
                  Sure?
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(item.run)}
                    className="rounded bg-utd-orange px-3 py-1.5 font-medium text-white disabled:opacity-60"
                  >
                    Yes, {item.label.split(" ")[0].toLowerCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded border border-line px-3 py-1.5 hover:border-ink"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setConfirming(item.id)}
                  className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink"
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
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

export default CommitteeActions
