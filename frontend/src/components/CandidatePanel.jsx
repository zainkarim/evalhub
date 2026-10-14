import { ALERT, formatRank, fullName, OFFER_STATUS } from "../lib/format"
import { waitingCopy } from "../lib/workflow"
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

// The observer list for a sign-up. Observer selection runs once for the whole
// cycle (Cycle page, after the sign-up deadline), so this panel only displays the
// result. There is no per-sign-up control here, and nothing to approve.
function CandidatePanel({ assessment, committee, owner }) {
  const { candidateList: list, candidates, signupDeadline } = assessment

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">Observer candidates</h2>

      {!list ? (
        <div className="mt-3 text-sm">
          <p className="text-muted">
            {owner
              ? `${waitingCopy(signupDeadline)} Your list of up to five professors will appear here.`
              : "Observer selection has not run for this sign-up yet. It starts for the whole term from the Cycle page."}
          </p>
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
            </div>
          ) : (
            <div className="mt-4">
              <CandidateTable candidates={candidates} offers={assessment.offers} />
            </div>
          )}
        </>
      )}

    </section>
  )
}

export { CandidateTable }
export default CandidatePanel
