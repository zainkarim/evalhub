import { useState } from "react"
import { api } from "../lib/api"
import { ALERT, formatDate, formatRank, fullName, OFFER_STATUS } from "../lib/format"
import StatusBadge from "./StatusBadge"

const th = "px-4 py-3 font-medium"
const td = "px-4 py-3"

// Candidates with their rank and school, and whether they have been asked yet.
function CandidateTable({ candidates, offers = [] }) {
  const latestOffer = (id) =>
    offers.filter((offer) => offer.observerId === id).sort((a, b) => b.id - a.id)[0]

  return (
    <div className="relative overflow-x-auto rounded border border-line">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs text-muted">
          <tr>
            <th className={th}>Professor</th>
            <th className={th}>Rank</th>
            <th className={th}>School</th>
            <th className={th}>Request</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const offer = latestOffer(candidate.id)
            return (
              <tr key={candidate.id} className="border-b border-line last:border-0">
                <td className={td}>{fullName(candidate)}</td>
                <td className={td}>{formatRank(candidate.rank)}</td>
                <td className={td}>{candidate.school}</td>
                <td className={td}>
                  {offer ? (
                    <StatusBadge status={offer.status} map={OFFER_STATUS} />
                  ) : (
                    <span className="text-muted">Not asked</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// The observer list for a sign-up. The committee starts candidate generation
// after the sign-up deadline (requirements §4.3 step 2); the professor never
// generates it, so until then they see a waiting state.
function CandidatePanel({ assessment, committee, owner, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const { candidateList: list, candidates, status, selectionOpen, signupDeadline } = assessment
  const canStart = committee && status === "signed_up" && (!list || list.poolSize === 0)

  const start = async () => {
    setBusy(true)
    setError("")
    try {
      await api.generateCandidates(assessment.id)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const startButton = canStart && (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy || !selectionOpen}
        onClick={start}
        className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
      >
        {busy ? "Starting…" : list ? "Check again" : "Start Observer Selection"}
      </button>
      {!selectionOpen && (
        <p className="mt-2 text-xs text-muted">
          Opens after the sign-up deadline ({formatDate(signupDeadline)}).
        </p>
      )}
    </div>
  )

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">Observer candidates</h2>

      {!list ? (
        <div className="mt-3 text-sm">
          <p className="text-muted">
            {owner
              ? `Waiting for the committee to start observer selection${selectionOpen ? "" : ` (after the sign-up deadline, ${formatDate(signupDeadline)})`}. Your list of up to five professors will appear here.`
              : "Observer selection has not been started for this sign-up."}
          </p>
          {startButton}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Matched on course level {list.targetLevel}000 in {list.targetSchool}, taught within
            the last 2 years, and free at class time. {list.poolSize} eligible ·{" "}
            {list.listSize} listed.
            {list.poolSize > 0 &&
              list.poolSize < 5 &&
              " Fewer than five qualify, so everyone eligible is listed."}
          </p>

          {assessment.alert && committee && (
            <p className="mt-3 text-sm">
              <StatusBadge status={assessment.alert} map={ALERT} />{" "}
              <span className="text-muted">{ALERT[assessment.alert].text}</span>
            </p>
          )}

          {list.listSize === 0 ? (
            <div className="mt-4 rounded border border-utd-orange/40 bg-canvas px-4 py-3 text-sm">
              <p className="font-medium">No eligible observers found.</p>
              <p className="mt-1 text-muted">
                {owner
                  ? "The committee has been alerted and will assign someone."
                  : "This is on the committee's alerts. Assign an observer below."}
              </p>
              {startButton}
            </div>
          ) : (
            <div className="mt-4">
              <CandidateTable candidates={candidates} offers={assessment.offers} />
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

export { CandidateTable }
export default CandidatePanel
