import { useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { api } from "../lib/api"
import {
  ASSESSMENT_STATUS,
  courseLabel,
  formatDate,
  formatRank,
  formatTerm,
} from "../lib/format"
import { useApi } from "../lib/useApi"

// Committee-only. Besides the profile, shows this professor's observation
// sign-ups so the committee can see who has been evaluated and when.
function ProfessorDetail() {
  const { id } = useParams()
  const call = useCallback(async () => {
    const [professor, signUps] = await Promise.all([
      api.getProfessor(id),
      api.listAssessments({ teacherId: id }),
    ])
    return { professor, signUps: signUps.data ?? [] }
  }, [id])
  const { data, error, loading, reload } = useApi(call)

  const professor = data?.professor
  const completed = (data?.signUps ?? []).filter((item) => item.status === "completed")
  const lastEvaluated = completed
    .map((item) => item.completedAt)
    .sort()
    .at(-1)

  return (
    <div>
      <Link
        to="/professors"
        className="text-sm text-muted hover:text-ink"
      >
        Back to professors
      </Link>

      <div className="mt-4">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {professor && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {professor.firstName} {professor.lastName}
                  </h1>

                  <p className="mt-1 text-muted">{formatRank(professor.rank)}</p>
                </div>

                <Link
                  to={`/professors/${professor.id}/edit`}
                  className="rounded border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Edit Professor
                </Link>
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 rounded border border-line bg-white p-6 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted">Email</dt>
                  <dd className="mt-0.5 text-sm">{professor.email}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted">School</dt>
                  <dd className="mt-0.5 text-sm">{professor.school}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted">Last evaluated</dt>
                  <dd className="mt-0.5 text-sm">
                    {lastEvaluated ? formatDate(lastEvaluated) : "Never"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted">Status</dt>
                  <dd className="mt-0.5 text-sm">
                    {professor.isActive ? "Active" : "Inactive"}
                  </dd>
                </div>
              </dl>

              <section className="mt-6 rounded border border-line bg-white p-6">
                <h2 className="text-sm font-semibold">Observation sign-ups</h2>
                {data.signUps.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    This professor hasn&apos;t signed up for an observation.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {data.signUps.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                      >
                        <span>
                          <Link
                            to={`/assessments/${item.id}`}
                            className="font-medium text-utd-green hover:underline"
                          >
                            {courseLabel(item.section.course)}
                          </Link>
                          <span className="text-muted">
                            {" "}
                            · {formatTerm(item.section.term)} · Section {item.section.sectionNumber}
                          </span>
                        </span>
                        <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default ProfessorDetail