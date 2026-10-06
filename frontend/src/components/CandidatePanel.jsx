import { useState } from "react"
import { api } from "../lib/api"
import { formatRank, fullName, REQUEST_STATUS, timeLeft } from "../lib/format"
import StatusBadge from "./StatusBadge"

const th = "px-4 py-3 font-medium"
const td = "px-4 py-3"

// The observer candidate list.
//   owner     -> the professor being observed: can pick who to send requests to
//   committee -> everyone else on the committee: same list, read-only, so they
//                can see how the pool was matched and who has answered
function CandidatePanel({ assessment, owner, onChanged }) {
  const [selected, setSelected] = useState([])
  const [possibleDates, setPossibleDates] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const { candidateList: list, candidates, status } = assessment
  const hasActivePairing = ["pending_ac_approval", "approved", "completed"].includes(status)
  const canRequest = owner && status === "candidates_generated" && list?.listSize > 0
  const canGenerate = ["signed_up", "candidates_generated"].includes(status) && !hasActivePairing

  const run = async (action) => {
    setBusy(true)
    setError("")
    try {
      await action()
      setSelected([])
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isPending = (candidate) => candidate.request?.status === "pending"
  const selectable = candidates.filter((candidate) => !isPending(candidate))

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )

  const allSelected = selectable.length > 0 && selected.length === selectable.length

    const addDate = () => {
      if (possibleDates.length < 8) {
        setPossibleDates([...possibleDates, ""])
      }
    }

    const updateDate = (index, value) => {
      setPossibleDates((current) =>
        current.map((date, i) => (i === index ? value : date)),
      )
    }

    const removeDate = (index) => {
      setPossibleDates((current) =>
        current.filter((_, i) => i !== index),
      )
    }

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">Observer candidates</h2>

      {!list ? (
        <div className="mt-3 text-sm">
          <p className="text-muted">
            {owner
              ? "Find professors from your school who have taught this course level. Up to five are shown, picked at random from everyone eligible."
              : "No candidate list has been generated for this sign-up yet."}
          </p>
          {canGenerate && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.generateCandidates(assessment.id))}
              className="mt-4 rounded bg-utd-green px-4 py-2 font-medium text-white hover:bg-utd-green-dark disabled:opacity-60"
            >
              {busy
                ? "Searching…"
                : owner
                  ? "Find observer candidates"
                  : "Generate candidate list"}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Matched on course level {list.targetLevel}000 in {list.targetSchool}, taught within
            the last 2 years, and free at class time. {list.poolSize} eligible ·{" "}
            {list.listSize} shown.
            {list.poolSize > 0 && list.poolSize < 5 &&
              " Fewer than five qualify, so everyone eligible is listed."}
          </p>

          {list.listSize === 0 ? (
            <div className="mt-4 rounded border border-utd-orange/40 bg-canvas px-4 py-3 text-sm">
              <p className="font-medium">No eligible observers found.</p>
              <p className="mt-1 text-muted">
                The committee has been notified on its dashboard and can step in as observer.
              </p>
              {canGenerate && status === "signed_up" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => api.generateCandidates(assessment.id))}
                  className="mt-3 rounded border border-line bg-white px-3 py-1.5 hover:border-ink disabled:opacity-60"
                >
                  {busy ? "Checking…" : "Check again"}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded border border-line">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs text-muted">
                  <tr>
                    {canRequest && (
                      <th className={`${th} w-10`}>
                        <input
                          type="checkbox"
                          aria-label="Select all available candidates"
                          checked={allSelected}
                          onChange={() =>
                            setSelected(allSelected ? [] : selectable.map((c) => c.id))
                          }
                        />
                      </th>
                    )}
                    <th className={th}>Professor</th>
                    <th className={th}>Rank</th>
                    <th className={th}>Request</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id} className="border-b border-line last:border-0">
                      {canRequest && (
                        <td className={td}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${fullName(candidate)}`}
                            disabled={isPending(candidate)}
                            checked={selected.includes(candidate.id)}
                            onChange={() => toggle(candidate.id)}
                          />
                        </td>
                      )}
                      <td className={td}>{fullName(candidate)}</td>
                      <td className={td}>{formatRank(candidate.rank)}</td>
                      <td className={td}>
                        {candidate.request ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={candidate.request.status} map={REQUEST_STATUS} />
                            {isPending(candidate) && (
                              <>
                                <span className="text-xs text-muted">
                                  {timeLeft(candidate.request.expiresAt)}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => run(() => api.cancelRequest(candidate.request.id))}
                                  className="text-xs text-utd-green hover:underline"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">Not requested</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canRequest && (
            <div className="mt-4">
          {selected.length > 0 && (
        <div className="mb-4 rounded border border-line bg-canvas p-4">
          <h3 className="text-sm font-semibold">Choose possible observation dates</h3>

          <p className="mt-1 text-xs text-muted">
            Select 4–8 possible class dates for the observer to choose from.
          </p>

          <div className="mt-3 space-y-2">
            {possibleDates.map((date, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(event) => updateDate(index, event.target.value)}
                  className="rounded border border-line bg-white px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={() => removeDate(index)}
                  className="text-xs text-muted hover:text-ink"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {possibleDates.length < 8 && (
            <button
              type="button"
              onClick={addDate}
              className="mt-3 rounded border border-line bg-white px-3 py-2 text-sm hover:border-ink"
            >
              + Add possible date
            </button>
          )}

          <p className="mt-2 text-xs text-muted">
            {possibleDates.filter(Boolean).length} of at least 4 dates selected
          </p>
        </div>
      )}
              <button
                type="button"
                disabled={
                  busy ||
                  selected.length === 0 ||
                  possibleDates.filter(Boolean).length < 4
                }
                onClick={() =>
                  run(() =>
                    api.sendRequests(
                      assessment.id,
                      selected,
                      possibleDates.filter(Boolean),
                    ),
                  )
                }
                className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
              >
                {busy
                  ? "Sending…"
                  : selected.length > 1
                    ? `Send ${selected.length} requests`
                    : "Send request"}
              </button>
              <p className="mt-2 text-xs text-muted">
                You can ask one, several, or all of them — only people on this list. Each
                request expires after 48 hours, and when one person accepts the rest are
                cancelled.
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}

export default CandidatePanel
