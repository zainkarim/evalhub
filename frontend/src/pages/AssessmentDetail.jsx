import { useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import CandidatePanel from "../components/CandidatePanel"
import CommitteeActions from "../components/CommitteeActions"
import PairingPanel from "../components/PairingPanel"
import SectionInfo from "../components/SectionInfo"
import StateBlock from "../components/StateBlock"
import Stepper from "../components/Stepper"
import StatusBadge from "../components/StatusBadge"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  ASSESSMENT_STATUS,
  ATTENTION,
  courseLabel,
  formatRank,
  formatDate,
  fullName,
  OBSERVATION_STATUS,
} from "../lib/format"
import { isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"
import { nextStep } from "../lib/workflow"

// One sign-up from start to finish. Two views of the same record:
//   the professor being observed -> picks observers and follows progress
//   committee members            -> see the candidate list, step in, approve
function AssessmentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const call = useCallback(() => api.getAssessment(id), [id])
  const { data: assessment, error, loading, reload } = useApi(call)

  const committee = isAC(user)
  const owner = assessment ? assessment.teacherId === user?.teacherId : false
  // A committee member handling their own sign-up acts as the professor, not
  // as the committee.
  const committeeView = committee && !owner

  const active = assessment?.observations.find((item) =>
    ["proposed", "approved"].includes(item.status),
  )
  const shown = active ?? assessment?.pairing
  const history = (assessment?.observations ?? []).filter((item) => item.id !== shown?.id)

  return (
    <div>
      <Link to="/observations" className="text-sm text-muted hover:text-ink">
        Back to observations
      </Link>

      <div className="mt-4">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {assessment && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {courseLabel(assessment.section.course)} · Section{" "}
                    {assessment.section.sectionNumber}
                  </h1>
                  <p className="mt-1 text-muted">{assessment.section.course.title}</p>
                  {committeeView && (
                    <p className="mt-1 text-sm">
                      Professor:{" "}
                      <Link
                        to={`/professors/${assessment.teacherId}`}
                        className="font-medium text-utd-green hover:underline"
                      >
                        {fullName(assessment.teacher)}
                      </Link>
                      <span className="text-muted"> · {formatRank(assessment.teacher.rank)}</span>
                    </p>
                  )}
                </div>
                <StatusBadge status={assessment.status} map={ASSESSMENT_STATUS} />
              </div>

              {assessment.attention && committeeView ? (
                <p className="mt-5 rounded border border-utd-orange/40 bg-white px-4 py-3 text-sm">
                  <span className="font-medium text-utd-orange">Needs committee attention. </span>
                  {ATTENTION[assessment.attention]}
                </p>
              ) : (
                <p className="mt-5 text-sm text-muted">
                  {owner ? "Next: " : "Status: "}
                  <span className="font-medium text-ink">{nextStep(assessment)}</span>
                </p>
              )}

              <Stepper assessment={assessment} />

              <SectionInfo
                section={assessment.section}
                instructor={committeeView ? assessment.teacher : undefined}
                className="mt-6"
              />

              {shown && <PairingPanel observation={shown} viewer={user} />}

              {!["cancelled", "postponed"].includes(assessment.status) && (
                <CandidatePanel assessment={assessment} owner={owner} onChanged={reload} />
              )}

              {committeeView && (
                <CommitteeActions assessment={assessment} onChanged={reload} />
              )}
              {committee && owner && (
                <p className="mt-6 rounded border border-line bg-white px-5 py-4 text-sm text-muted">
                  This is your own sign-up, so another committee member handles any step-in.
                </p>
              )}

              {history.length > 0 && (
                <section className="mt-6 rounded border border-line bg-white p-6">
                  <h2 className="text-sm font-semibold">Earlier attempts</h2>
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {history.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span>
                          Attempt {item.attemptNo}: {fullName(item.observer)} ·{" "}
                          {formatDate(item.scheduledDate)}
                        </span>
                        <StatusBadge status={item.status} map={OBSERVATION_STATUS} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default AssessmentDetail
