import {
  ALERT,
  formatDate,
  formatTimeRange,
  fullName,
  OFFER_STATUS,
  timeLeft,
} from "../lib/format"
import { CandidateTable } from "./CandidatePanel"
import { Field } from "./SectionInfo"
import StatusBadge from "./StatusBadge"

// Read-only committee view of the observer side of a sign-up: the pool and list
// sizes, the candidates, who was asked, the dates offered and the confirmed date.
// `assessment` is the detail shape (GET /assessments/:id).
function ObserverSummary({ assessment, showCandidates = true }) {
  const { candidateList: list, candidates, offer, offers, pairing, status, alert } = assessment
  const confirmedOption = assessment.timeOptions.find(
    (option) => option.isConfirmed && option.attemptNo === assessment.attemptNo,
  )
  const scheduled = ["approved", "completed"].includes(status) ? pairing : null
  const latest = offer ?? [...offers].sort((a, b) => b.id - a.id)[0]
  const offered = offer?.options ?? latest?.options ?? []

  return (
    <div className="text-sm">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
        <Field label="Observer selection">
          {list ? (
            <>
              {list.poolSize} eligible · {list.listSize} listed
              {alert && (
                <span className="mt-1 block">
                  <StatusBadge status={alert} map={ALERT} />
                </span>
              )}
            </>
          ) : (
            <span className="text-muted">Not started</span>
          )}
        </Field>
        <Field label="Requested observer">
          {scheduled ? (
            <>
              {fullName(scheduled.observer)}
              {scheduled.isAcStepin && (
                <span className="block text-xs text-muted">Committee assignment</span>
              )}
            </>
          ) : latest ? (
            <>
              {fullName(latest.observer)}
              <span className="mt-1 block">
                <StatusBadge status={latest.status} map={OFFER_STATUS} />
              </span>
              {latest.status === "pending" && (
                <span className="block text-xs text-muted">{timeLeft(latest.expiresAt)}</span>
              )}
            </>
          ) : (
            <span className="text-muted">—</span>
          )}
        </Field>
        <Field label="Confirmed date">
          {scheduled ? (
            formatDate(scheduled.scheduledDate)
          ) : confirmedOption ? (
            formatDate(confirmedOption.proposedDate)
          ) : (
            <span className="text-muted">Not confirmed yet</span>
          )}
        </Field>
      </dl>

      {offered.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted">Dates offered</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {offered.map((option) => (
              <li key={option.id} className={option.isConfirmed ? "font-medium text-utd-green-dark" : ""}>
                {option.isConfirmed ? "✓ " : ""}
                {formatDate(option.proposedDate)} ·{" "}
                {formatTimeRange(option.startTime, option.endTime)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCandidates && candidates.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-muted">Candidates</p>
          <CandidateTable candidates={candidates} offers={offers} />
        </div>
      )}
    </div>
  )
}

export default ObserverSummary
