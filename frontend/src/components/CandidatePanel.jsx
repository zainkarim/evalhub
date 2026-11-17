import { ALERT, formatRank, fullName, OFFER_STATUS } from "../lib/format"
import { waitingCopy } from "../lib/workflow"
import StatusBadge from "./StatusBadge"
import { Callout, Card, Table, TableCard, Td, Th } from "./ui"

// Candidates with their rank and school, and whether they have been asked yet.
function CandidateTable({ candidates, offers = [] }) {
  const latestOffer = (id) =>
    offers.filter((offer) => offer.observerId === id).sort((a, b) => b.id - a.id)[0]

  return (
    <TableCard>
      <Table minWidth="30rem">
        <thead>
          <tr>
            <Th>Professor</Th>
            <Th>Rank</Th>
            <Th>School</Th>
            <Th>Request</Th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const offer = latestOffer(candidate.id)
            return (
              <tr key={candidate.id} className="border-b border-line last:border-0">
                <Td>{fullName(candidate)}</Td>
                <Td>{formatRank(candidate.rank)}</Td>
                <Td>{candidate.school}</Td>
                <Td>
                  {offer ? (
                    <StatusBadge status={offer.status} map={OFFER_STATUS} />
                  ) : (
                    <span className="text-muted">Not asked</span>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}

// The observer list for a sign-up. Observer selection runs once for the whole
// cycle (Cycle page, after the sign-up deadline), so this panel only displays the
// result. There is no per-sign-up control here, and nothing to approve.
function CandidatePanel({ assessment, committee, owner }) {
  const { candidateList: list, candidates, signupDeadline } = assessment

  return (
    <Card as="section" className="mt-6">
      <h2 className="text-base font-semibold">Observer candidates</h2>

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
            <Callout tone="warning" title="No eligible observers found." className="mt-4">
              {owner
                ? "The committee has been alerted and will assign someone."
                : "This is on the committee's alerts. Assign an observer below."}
            </Callout>
          ) : (
            <div className="mt-4">
              <CandidateTable candidates={candidates} offers={assessment.offers} />
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export { CandidateTable }
export default CandidatePanel
