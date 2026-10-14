import { useCallback, useState } from "react"
import { api } from "../lib/api"
import { formatDate, fullName, meetingDates } from "../lib/format"
import { useApi } from "../lib/useApi"
import PostponeControl from "./PostponeControl"

// TODO(BLOCKED: requirements §4.3 step 6 and §8): when the committee assigns an
// observer manually, must the pick come from the eligible pool, or can it be any
// faculty member? This has not been answered, so this form keeps its existing
// behaviour (a candidate-list member, or a committee member as step-in) and must
// not be read as the answer.
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
      <h3 className="text-sm font-medium">Assign an observer manually</h3>
      <p className="mt-1 text-sm text-muted">
        Use this when no candidate is eligible or the professor&apos;s requests didn&apos;t work
        out. The observation is scheduled straight away.
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

// Committee-only controls on a sign-up: assign an observer manually, or postpone
// with a recorded reason. There is nothing to approve and nothing is cancelled.
function CommitteeActions({ assessment, onChanged }) {
  const { status, candidateList } = assessment
  const canAssign =
    ["candidates_generated", "postponed"].includes(status) ||
    (status === "signed_up" && Boolean(candidateList))
  const canPostpone = ["signed_up", "candidates_generated", "approved"].includes(status)

  if (!canAssign && !canPostpone) return null

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">Committee actions</h2>

      {canAssign && (
        <div className="mt-4">
          <AssignObserver assessment={assessment} onChanged={onChanged} />
        </div>
      )}

      {canPostpone && (
        <div className={canAssign ? "mt-6 border-t border-line pt-4" : "mt-4"}>
          <h3 className="text-sm font-medium">Can&apos;t go ahead right now?</h3>
          <p className="mt-1 mb-3 text-sm text-muted">
            The sign-up is kept and marked Postponed; the reason is added to the attempt history.
          </p>
          <PostponeControl
            label="Postpone sign-up"
            onSubmit={(reason) => api.postponeAssessment(assessment.id, reason)}
            onDone={onChanged}
          />
        </div>
      )}
    </section>
  )
}

export default CommitteeActions
