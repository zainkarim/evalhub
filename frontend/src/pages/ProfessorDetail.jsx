import { useCallback } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, TableCard, Td, Th } from "../components/ui"
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

// min-w-0 + break-words: a long email wraps inside its own cell instead of running
// into the next one (the 390px overlap).
function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
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
              <span className="min-w-0">
                <Link to={`/records/${row.id}`} className="font-medium text-primary hover:underline">
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
    <div className="space-y-6">
      <PageHeader
        backTo={{
          to: backTermId ? `/professors?termId=${backTermId}` : "/professors",
          label: "Back to professors",
        }}
        title={professor ? `${professor.firstName} ${professor.lastName}` : "Professor"}
        subtitle={professor ? `${formatRank(professor.rank)} · ${professor.department}` : undefined}
        action={
          professor && (
            <Button variant="secondary" to={`/professors/${professor.id}/edit`}>
              Edit Professor
            </Button>
          )
        }
      />

      <StateBlock loading={loading} error={error} onRetry={reload}>
        {professor && (
          <>
            <Card>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
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
            </Card>

            <Card padded={false}>
              <CardHeader
                title={`Observer load · ${formatTerm(data.term)}`}
                description={`An observer takes at most ${load.cap} observations per cycle; at the limit they are no longer suggested to anyone.`}
              />
              <CardBody className="pb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="h-2 w-40 rounded bg-surface-2"
                    role="progressbar"
                    aria-label="Observations as observer"
                    aria-valuemin={0}
                    aria-valuemax={load.cap}
                    aria-valuenow={Math.min(load.count, load.cap)}
                  >
                    <div
                      className={`h-2 rounded ${load.count >= load.cap ? "bg-accent" : "bg-primary"}`}
                      style={{ width: `${Math.min(load.count / load.cap, 1) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {load.count} of {load.cap}
                    {load.count >= load.cap && (
                      <Badge tone="warning" className="ml-2">
                        At the limit
                      </Badge>
                    )}
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card padded={false}>
              <CardHeader
                title="Courses"
                description={`Taught in ${formatTerm(data.term)} and in the last two years up to today. Observers are matched by course level and department.`}
              />
              <CardBody className="pb-6">
                {data.courses.length === 0 ? (
                  <EmptyState compact titleAs="p" title="No sections on record for this period" />
                ) : (
                  <TableCard>
                    <Table minWidth="34rem">
                      <thead>
                        <tr>
                          <Th>Course</Th>
                          <Th>Level</Th>
                          <Th>Department</Th>
                          <Th>Semester</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.courses.map((course) => (
                          <tr key={course.sectionId} className="border-b border-line last:border-0">
                            <Td>
                              <span className="font-medium">{course.course}</span>
                              <span className="text-muted"> · Section {course.sectionNumber}</span>
                              <span className="block text-muted">{course.title}</span>
                            </Td>
                            <Td>{course.level}000</Td>
                            <Td>{course.department}</Td>
                            <Td>
                              {formatTerm(course.term)}
                              {course.thisTerm && (
                                <Badge tone="success" size="sm" className="ml-2">
                                  This term
                                </Badge>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableCard>
                )}
              </CardBody>
            </Card>

            <Card padded={false}>
              <CardHeader title="Observations" />
              <CardBody className="space-y-5 pb-6">
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
              </CardBody>
            </Card>

            <Card padded={false}>
              <CardHeader title={`Sign-up · ${formatTerm(data.term)}`} />
              <CardBody className="pb-6">
                {data.signUp ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <Link
                        to={`/assessments/${data.signUp.assessmentId}`}
                        className="font-medium text-primary hover:underline"
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
                  <p className="text-sm text-muted">
                    This professor hasn&apos;t signed up for {formatTerm(data.term)}.
                  </p>
                )}
              </CardBody>
            </Card>

            {data.signUp && <AttemptHistory attempts={data.signUp.attempts} />}
          </>
        )}
      </StateBlock>
    </div>
  )
}

export default ProfessorDetail
