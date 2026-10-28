import { useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import CandidatePanel from "../components/CandidatePanel"
import CommitteeActions from "../components/CommitteeActions"
import ObserverSummary from "../components/ObserverSummary"
import PairingPanel from "../components/PairingPanel"
import RequestPanel from "../components/RequestPanel"
import SectionInfo from "../components/SectionInfo"
import StateBlock from "../components/StateBlock"
import Stepper from "../components/Stepper"
import StatusBadge from "../components/StatusBadge"
import { Callout, Card, PageHeader } from "../components/ui"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  ALERT,
  ASSESSMENT_STATUS,
  courseLabel,
  formatRank,
  fullName,
  normalizeStatus,
} from "../lib/format"
import { isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"
import { nextStep } from "../lib/workflow"

// One sign-up from start to finish. Two views of the same record:
//   the professor being observed -> follows progress, picks ONE observer + dates
//   committee members            -> see the pool and candidates, assign manually
//                                   (stretch goal), postpone
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

  const shown = assessment?.pairing
  const status = assessment ? normalizeStatus(assessment.status) : null
  const canRequest =
    owner &&
    ["candidates_generated", "postponed"].includes(status) &&
    assessment.candidateList?.listSize > 0

  return (
    <div>
      <PageHeader
        backTo={{ to: "/observations", label: "Back to observations" }}
        title={
          assessment
            ? `${courseLabel(assessment.section.course)} · Section ${assessment.section.sectionNumber}`
            : "Sign-up"
        }
        subtitle={
          assessment && (
            <>
              {assessment.section.course.title}
              {committeeView && (
                <span className="mt-1 block">
                  Professor:{" "}
                  <Link
                    to={`/professors/${assessment.teacherId}`}
                    className="font-medium text-primary-ink hover:underline"
                  >
                    {fullName(assessment.teacher)}
                  </Link>
                  <span>
                    {" "}
                    · {formatRank(assessment.teacher.rank)} · {assessment.teacher.school}
                  </span>
                </span>
              )}
            </>
          )
        }
        action={assessment && <StatusBadge status={assessment.status} map={ASSESSMENT_STATUS} />}
      />

      {/* Every block below starts with its own top margin; the first one doesn't need it. */}
      <div className="mt-6 [&>:first-child]:mt-0">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {assessment && (
            <>
              <Card>
                {assessment.alert && committeeView ? (
                  <Callout tone="warning" title={`${ALERT[assessment.alert].label}.`}>
                    {ALERT[assessment.alert].text}
                  </Callout>
                ) : (
                  <p className="text-sm text-muted">
                    {owner ? "Next: " : "Status: "}
                    <span className="font-medium text-ink">{nextStep(assessment)}</span>
                  </p>
                )}
                <Stepper assessment={assessment} />
              </Card>

              <SectionInfo
                section={assessment.section}
                instructor={committeeView ? assessment.teacher : undefined}
                className="mt-6"
              />

              {shown && <PairingPanel observation={shown} viewer={user} />}

              <CandidatePanel assessment={assessment} committee={committeeView} owner={owner} />

              {committeeView && (
                <Card as="section" className="mt-6">
                  <h2 className="text-base font-semibold">Request and schedule</h2>
                  <div className="mt-3">
                    <ObserverSummary assessment={assessment} showCandidates={false} />
                  </div>
                </Card>
              )}

              {canRequest && <RequestPanel assessment={assessment} onChanged={reload} />}

              {committeeView && <CommitteeActions assessment={assessment} onChanged={reload} />}
              {committee && owner && (
                <Card className="mt-6 text-sm text-muted">
                  This is your own sign-up, so another committee member handles any manual
                  assignment.
                </Card>
              )}

              <AttemptHistory attempts={assessment.attempts} />
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default AssessmentDetail
