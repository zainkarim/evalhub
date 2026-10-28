import { useCallback } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { api } from "../lib/api"
import { describeDue, DUE_STATUS } from "../lib/dueStatus"
import {
  ACTIVE_STATUS,
  ASSESSMENT_STATUS,
  CURRENT_STATUS,
  OBSERVATION_STATUS,
  currentStatusDetail,
  formatDate,
  formatMeeting,
  formatRank,
  formatTerm,
  fullName,
} from "../lib/format"
import { useApi } from "../lib/useApi"

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

function ObservationList({ title, empty, rows }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span>
                <Link to={`/records/${row.id}`} className="font-medium text-utd-green hover:underline">
                  {row.course}
                </Link>
                <span className="text-muted">
                  {" "}
                  · {formatTerm(row.term)} · {row.date ? formatDate(row.date) : "No date yet"} ·{" "}
                  {row.role === "observer" ? "observing" : "observed by"} {fullName(row.partner)}
                </span>
              </span>
              <StatusBadge status={row.status} map={OBSERVATION_STATUS} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Committee-only. Everything the committee needs to choose observer candidates and to see
// a professor's history for one semester (?termId=, the Professors page passes its own).
function ProfessorDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const termId = searchParams.get("termId")
  const call = useCallback(() => api.professorProfile(id, termId), [id, termId])
  const { data, error, loading, reload } = useApi(call)

  const backTermId = termId ?? data?.term.id
  const professor = data?.teacher
  const summary = data?.summary
  const given = (data?.observations ?? []).filter((row) => row.role === "observer")
  const received = (data?.observations ?? []).filter((row) => row.role === "observee")
  const load = data?.observerLoad

  return (
    <div>
      <Link
        to={backTermId ? `/professors?termId=${backTermId}` : "/professors"}
        className="text-sm text-muted hover:text-ink"
      >
        Back to professors
      </Link>

      <div className="mt-4">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {professor && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {professor.firstName} {professor.lastName}
                  </h1>
                  <p className="mt-1 text-muted">
                    {formatRank(professor.rank)} · {professor.department}
                  </p>
                </div>

                <Link
                  to={`/professors/${professor.id}/edit`}
                  className="rounded border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
                >
                  Edit Professor
                </Link>
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 rounded border border-line bg-surface p-6 sm:grid-cols-3">
                <Fact label="Email">{professor.email}</Fact>
                <Fact label="School">{professor.school}</Fact>
                <Fact label="Status">
                  <StatusBadge status={professor.isActive ? "active" : "inactive"} map={ACTIVE_STATUS} />
                </Fact>
                <Fact label={`Due status · ${formatTerm(data.term)}`}>
                  <StatusBadge status={summary.dueStatus} map={DUE_STATUS} />
                </Fact>
                <Fact label="Next due">
                  {describeDue({ status: summary.dueStatus, dueWindow: summary.dueWindow })}
                </Fact>
                <Fact label="Last observed">
                  {summary.lastCompleted ? formatDate(summary.lastCompleted.date) : "Never"}
                </Fact>
              </dl>

              <section className="mt-6 rounded border border-line bg-surface p-6">
                <h2 className="text-sm font-semibold">Observer load · {formatTerm(data.term)}</h2>
                <p className="mt-1 text-sm text-muted">
                  An observer takes at most {load.cap} observations per cycle; at the limit they are no
                  longer suggested to anyone.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-2 w-40 rounded bg-surface-2"
                    role="progressbar"
                    aria-label="Observations as observer"
                    aria-valuemin={0}
                    aria-valuemax={load.cap}
                    aria-valuenow={Math.min(load.count, load.cap)}
                  >
                    <div
                      className={`h-2 rounded ${load.count >= load.cap ? "bg-utd-orange" : "bg-utd-green"}`}
                      style={{ width: `${Math.min(load.count / load.cap, 1) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium">
                    {load.count} of {load.cap}
                    {load.count >= load.cap && <span className="ml-2 text-warning">At the limit</span>}
                  </p>
                </div>
              </section>

              <section className="mt-6 rounded border border-line bg-surface p-6">
                <h2 className="text-sm font-semibold">Courses</h2>
                <p className="mt-1 text-sm text-muted">
                  Taught in {formatTerm(data.term)} and in the last two years up to today. Observers are matched
                  by course level and department.
                </p>
                {data.courses.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No sections on record for this period.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <thead className="border-b border-line text-xs text-muted">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Course</th>
                          <th className="py-2 pr-4 font-medium">Level</th>
                          <th className="py-2 pr-4 font-medium">Department</th>
                          <th className="py-2 font-medium">Semester</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.courses.map((course) => (
                          <tr key={course.sectionId} className="border-b border-line last:border-0">
                            <td className="py-2.5 pr-4">
                              <span className="font-medium">{course.course}</span>
                              <span className="text-muted"> · Section {course.sectionNumber}</span>
                              <span className="block text-muted">{course.title}</span>
                            </td>
                            <td className="py-2.5 pr-4">{course.level}000</td>
                            <td className="py-2.5 pr-4">{course.department}</td>
                            <td className="py-2.5">
                              {formatTerm(course.term)}
                              {course.thisTerm && <span className="ml-2 text-xs text-utd-green-dark">This term</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="mt-6 rounded border border-line bg-surface p-6">
                <h2 className="text-sm font-semibold">Observations</h2>
                <div className="mt-3 space-y-5">
                  <ObservationList
                    title="Received (as observee)"
                    empty="No one has observed this professor yet."
                    rows={received}
                  />
                  <ObservationList
                    title="Given (as observer)"
                    empty="This professor has not observed anyone yet."
                    rows={given}
                  />
                </div>
              </section>

              <section className="mt-6 rounded border border-line bg-surface p-6">
                <h2 className="text-sm font-semibold">Sign-up · {formatTerm(data.term)}</h2>
                {data.signUp ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span>
                      <Link
                        to={`/assessments/${data.signUp.assessmentId}`}
                        className="font-medium text-utd-green hover:underline"
                      >
                        {summary.signUp.course} · Section {summary.signUp.section}
                      </Link>
                      <span className="text-muted"> · {formatMeeting(data.signUp.section)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={data.signUp.status} map={ASSESSMENT_STATUS} />
                      {summary.currentStatus !== "none" && (
                        <span className="text-xs text-muted">
                          {CURRENT_STATUS[summary.currentStatus]?.label}
                          {currentStatusDetail(summary) ? ` · ${currentStatusDetail(summary)}` : ""}
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    This professor hasn&apos;t signed up for {formatTerm(data.term)}.
                  </p>
                )}
              </section>

              {data.signUp && <AttemptHistory attempts={data.signUp.attempts} />}
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default ProfessorDetail
