import { Link } from "react-router-dom"
import { formatRank } from "../lib/format"
import { Card, CardBody, CardHeader } from "./ui"
import { cx } from "./ui/cx"

// The twelve committee KPIs from GET /teachers/report (#72). The faculty and
// completion group comes from one backend PR and the observer matching group from
// another, so each group only renders when its fields are present. A mock server or
// an older backend that sends neither shows no panel.

const percent = (value) => (value === null || value === undefined ? "—" : `${value}%`)
const number = (value) => (value === null || value === undefined ? "—" : value)

function Kpi({ label, value, note, unavailable = false }) {
  return (
    <div
      className={cx(
        "rounded-card border border-line bg-surface px-4 py-3 shadow-xs",
        unavailable && "bg-surface-2/50",
      )}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tracking-tight tabular-nums", unavailable && "text-muted")}>
        {unavailable ? "—" : value}
      </p>
      {unavailable && <p className="text-xs font-medium text-muted">Not available yet</p>}
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}

function Group({ title, description, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}

function NameList({ title, empty, items, termId, detail }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {items.map((item) => (
            <li key={item.assessmentId} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
              <Link
                to={`/professors/${item.teacherId}?termId=${termId}`}
                className="font-medium text-primary-ink hover:underline"
              >
                {item.name ?? `Professor ${item.teacherId}`}
              </Link>
              <span className="text-muted">{detail(item)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const courseText = (item) => [item.course, item.section && `section ${item.section}`].filter(Boolean).join(" · ")
const byRank = (counts) =>
  Object.entries(counts ?? {})
    .map(([rank, n]) => `${formatRank(rank)} ${n}`)
    .join(" · ")

function FacultyGroup({ report }) {
  const { counts = {}, assessmentParticipation, surveyCompletion, evaluationEligibilityAccuracy } = report
  return (
    <Group
      title="Faculty and completion"
      description="Who is due, who is taking part, and what is still missing this semester."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Faculty due, by rank" value={number(counts.due)} note={byRank(counts.dueByRank)} />
        <Kpi
          label="Overdue and still outstanding"
          value={number(counts.overdueOutstanding)}
          note={counts.overdue !== undefined ? `${counts.overdue} overdue in total` : undefined}
        />
        <Kpi
          label="Assessment participation"
          value={percent(assessmentParticipation?.ratePercent)}
          note={
            assessmentParticipation
              ? `${assessmentParticipation.participating} of ${assessmentParticipation.eligible} eligible faculty signed up`
              : undefined
          }
        />
        <Kpi label="Missing observations" value={number(counts.missingObservations)} note="Sign-ups with no completed observation" />
        <Kpi
          label="Survey completion"
          value={percent(surveyCompletion?.ratePercent)}
          unavailable={surveyCompletion?.status === "unavailable"}
          note={surveyCompletion?.status === "unavailable" ? surveyCompletion.reason : undefined}
        />
        <Kpi
          label="Evaluation eligibility accuracy"
          value={percent(evaluationEligibilityAccuracy?.ratePercent)}
          unavailable={evaluationEligibilityAccuracy?.status === "unavailable"}
          note={evaluationEligibilityAccuracy?.status === "unavailable" ? evaluationEligibilityAccuracy.reason : undefined}
        />
      </div>
    </Group>
  )
}

function ObserverGroup({ report }) {
  const {
    observerUtilization: utilization,
    averageObservationsPerObserver: averageLoad,
    courseLevelMatchAccuracy: matchAccuracy,
    listSufficiency,
    unmatchedFaculty = [],
    outstandingObservations = [],
  } = report
  const termId = report.term.id

  return (
    <Group
      title="Observer matching"
      description="How the observer pool is being used and whether professors can be matched."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Observer utilization"
          value={percent(utilization.ratePercent)}
          note={`${utilization.activeObservers} of ${utilization.poolSize} observers used`}
        />
        <Kpi
          label="Observations per observer"
          value={number(averageLoad?.average)}
          note={`${averageLoad?.totalObservations ?? 0} across ${averageLoad?.activeObservers ?? 0} ${averageLoad?.activeObservers === 1 ? "observer" : "observers"}`}
        />
        <Kpi
          label="Course-level match"
          value={percent(matchAccuracy?.ratePercent)}
          note={`${matchAccuracy?.matching ?? 0} of ${matchAccuracy?.total ?? 0} observers qualify`}
        />
        <Kpi
          label="List sufficiency"
          value={percent(listSufficiency?.ratePercent)}
          note={`${listSufficiency?.sufficient ?? 0} of ${listSufficiency?.generated ?? 0} lists full`}
        />
      </div>
      <div className="grid gap-6 pt-2 lg:grid-cols-2">
        <NameList
          title="Unmatched faculty"
          empty="Everyone who signed up has at least one eligible observer."
          items={unmatchedFaculty}
          termId={termId}
          detail={courseText}
        />
        <NameList
          title="Outstanding observations"
          empty="No sign-ups are past the observation deadline."
          items={outstandingObservations}
          termId={termId}
          detail={(item) => [courseText(item), item.status?.replaceAll("_", " ")].filter(Boolean).join(" · ")}
        />
      </div>
    </Group>
  )
}

function KpiPanel({ report }) {
  const hasFaculty = Boolean(
    report.assessmentParticipation || report.surveyCompletion || report.evaluationEligibilityAccuracy,
  )
  const hasObserver = Boolean(report.observerUtilization)
  if (!hasFaculty && !hasObserver) return null

  return (
    <Card padded={false}>
      <CardHeader title="Committee KPIs" description="Measures for the selected semester." />
      <CardBody className="space-y-8 pb-6 pt-4">
        {hasFaculty && <FacultyGroup report={report} />}
        {hasObserver && <ObserverGroup report={report} />}
      </CardBody>
    </Card>
  )
}

export default KpiPanel
