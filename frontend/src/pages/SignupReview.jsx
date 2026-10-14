import { Fragment, useCallback, useState } from "react"
import { Link } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import ObserverSummary from "../components/ObserverSummary"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { api } from "../lib/api"
import {
  ALERT,
  ASSESSMENT_STATUS,
  courseLabel,
  formatDate,
  formatLocalDate,
  formatMeeting,
  formatRank,
  formatTerm,
  fullName,
  normalizeStatus,
  todayISO,
  toDateOnly,
} from "../lib/format"
import { useApi } from "../lib/useApi"

const th = "px-4 py-3 font-medium"
const td = "px-4 py-3 align-top"

function Heading({ title, count, hint }) {
  return (
    <div className="mt-10 first:mt-6">
      <h2 className="text-sm font-semibold">
        {title}
        {count > 0 && (
          <span className="ml-2 rounded-full bg-utd-orange px-2 py-0.5 text-[11px] font-semibold text-white">
            {count}
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  )
}

const errorBox = "mt-3 rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm"

// Observer pool alerts: nobody eligible (urgent) or a short list (limited pool).
function Alerts({ alerts }) {
  if (alerts.length === 0) {
    return (
      <p className="mt-3 rounded border border-line bg-white px-5 py-6 text-sm text-muted">
        No alerts. Every sign-up that has started observer selection has a full list.
      </p>
    )
  }
  return (
    <ul className="mt-3 divide-y divide-line rounded border border-line bg-white">
      {alerts.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
          <div>
            <p>
              <StatusBadge status={item.alert} map={ALERT} />{" "}
              <span className="font-medium">{fullName(item.teacher)}</span>
              <span className="text-muted"> · {formatRank(item.teacher.rank)}</span>
            </p>
            <p className="mt-1">
              {courseLabel(item.section.course)} · {item.section.course.title} · Section{" "}
              {item.section.sectionNumber}
              <span className="text-muted"> · {formatTerm(item.section.term)}</span>
            </p>
            <p className="mt-1 text-muted">
              Pool size {item.candidateSummary.poolSize} · list size {item.candidateSummary.listSize}.{" "}
              {ALERT[item.alert].text}
            </p>
          </div>
          <Link
            to={`/assessments/${item.id}`}
            className="whitespace-nowrap font-medium text-utd-green hover:underline"
          >
            Open and resolve
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Details({ id }) {
  const call = useCallback(() => api.getAssessment(id), [id])
  const { data, error, loading, reload } = useApi(call)
  return (
    <StateBlock loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <ObserverSummary assessment={data} />
          <AttemptHistory attempts={data.attempts} />
          <p className="mt-4">
            <Link
              to={`/assessments/${id}`}
              className="text-sm font-medium text-utd-green hover:underline"
            >
              Open the full sign-up
            </Link>
          </p>
        </>
      )}
    </StateBlock>
  )
}

function SelectionCell({ item }) {
  if (!item.candidateSummary) {
    return (
      <>
        <span className="text-muted">Not started</span>
        {item.status === "signed_up" && !item.selectionOpen && (
          <span className="block text-xs text-muted">
            Locked: opens after the sign-up deadline ({formatDate(item.signupDeadline)})
          </span>
        )}
      </>
    )
  }
  return (
    <>
      {item.candidateSummary.poolSize} eligible · {item.candidateSummary.listSize} listed
      {item.alert && (
        <span className="mt-1 block">
          <StatusBadge status={item.alert} map={ALERT} />
        </span>
      )}
    </>
  )
}

// The committee's working page and landing dashboard: sign-ups to review after
// the deadline, the Start Observer Selection action, and alerts for empty or
// short observer pools. The committee does not approve pairings.
function SignupReview() {
  const [termId, setTermId] = useState(null)
  const [open, setOpen] = useState(null) // expanded sign-up id
  const [confirming, setConfirming] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [busy, setBusy] = useState(null) // "bulk" | sign-up id
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")

  const call = useCallback(async () => {
    const [terms, assessments, alerts] = await Promise.all([
      api.listTerms({}),
      api.listAssessments({}),
      api.assessmentAlerts(),
    ])
    return {
      terms: terms.data ?? [],
      assessments: assessments.data ?? [],
      alerts: alerts.data ?? [],
      counts: alerts.counts,
    }
  }, [])
  const { data, error, loading, reload } = useApi(call)

  // Terms that take sign-ups: current or upcoming Spring/Fall terms, plus any
  // term that already has a sign-up.
  const used = new Set((data?.assessments ?? []).map((item) => item.dueTermId))
  const terms = (data?.terms ?? [])
    .filter(
      (term) =>
        used.has(term.id) ||
        (term.season !== "summer" && toDateOnly(term.endDate) >= todayISO()),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const current =
    terms.find((term) => term.id === termId) ??
    terms.find((term) => term.startDate <= todayISO() && term.endDate >= todayISO()) ??
    terms[0]

  const rows = (data?.assessments ?? []).filter((item) => item.dueTermId === current?.id)
  const waiting = rows.filter((item) => item.status === "signed_up" && !item.candidateSummary)
  const selectionOpen = !current?.signupDeadline || todayISO() > toDateOnly(current.signupDeadline)
  const stage = (status) => rows.filter((item) => normalizeStatus(item.status) === status).length
  const text = search.trim().toLowerCase()
  const shown = rows.filter(
    (item) =>
      (!statusFilter || normalizeStatus(item.status) === statusFilter) &&
      (!text ||
        `${fullName(item.teacher)} ${courseLabel(item.section.course)} ${item.section.course.title} ${item.section.sectionNumber}`
          .toLowerCase()
          .includes(text)),
  )

  const run = async (key, action) => {
    setBusy(key)
    setActionError("")
    setNotice("")
    try {
      await action()
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  const startAll = () =>
    run("bulk", async () => {
      const result = await api.startSelection({ termId: current.id })
      const parts = [`Observer selection started for ${result.started} sign-up${result.started === 1 ? "" : "s"}.`]
      if (result.noEligible) parts.push(`${result.noEligible} with no eligible observer.`)
      if (result.limited) parts.push(`${result.limited} with a limited pool.`)
      if (result.skipped) parts.push(`${result.skipped} skipped (deadline not reached).`)
      setNotice(parts.join(" "))
    })

  const startOne = (item) =>
    run(item.id, async () => {
      await api.generateCandidates(item.id)
      setNotice(`Observer selection started for ${fullName(item.teacher)} · ${courseLabel(item.section.course)}.`)
    })

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Sign-up review</h1>
      <p className="mt-1 text-sm text-muted">
        After the sign-up deadline, review the sign-ups and start observer selection. Professors
        then choose their own observer; the committee handles empty or short pools.
      </p>

      <StateBlock loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <Heading
              title="Observer pool alerts"
              count={data.alerts.length}
              hint="A sign-up whose eligible pool is empty (urgent) or smaller than five (limited pool). Open it to resolve it manually."
            />
            <Alerts alerts={data.alerts} />

            <Heading
              title="Sign-ups"
              count={0}
              hint="Course, section, meeting time and the observer side of each sign-up. Expand a row for the candidates, requested observer, offered dates and attempt history."
            />

            {current ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div>
                    <label htmlFor="term" className="sr-only">
                      Term
                    </label>
                    <select
                      id="term"
                      value={current.id}
                      onChange={(event) => {
                        setTermId(Number(event.target.value))
                        setOpen(null)
                        setNotice("")
                      }}
                      className="rounded border border-line bg-white px-3 py-2 text-sm"
                    >
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {formatTerm(term)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-sm text-muted">
                    {current.signupDeadline
                      ? `Sign-up deadline ${formatDate(current.signupDeadline)} — ${selectionOpen ? "passed, selection can start" : "not reached yet"}`
                      : "No sign-up deadline set for this term"}
                  </p>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  {[
                    ["Waiting to start", waiting.length],
                    ["Choosing observer", stage("candidates_generated")],
                    ["Scheduled", stage("approved")],
                    ["Completed", stage("completed")],
                    ["Postponed", stage("postponed")],
                  ].map(([label, count]) => (
                    <div key={label} className="rounded border border-line bg-white px-4 py-3">
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-0.5 text-lg font-semibold">{count}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 rounded border border-line bg-white p-5">
                  <h3 className="text-sm font-medium">Start Observer Selection</h3>
                  <p className="mt-1 text-sm text-muted">
                    {waiting.length === 0
                      ? "No sign-ups in this term are waiting for observer selection."
                      : `${waiting.length} sign-up${waiting.length === 1 ? " is" : "s are"} waiting. Starting builds each professor's list of up to five observers and lets them choose.`}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {confirming ? (
                      <span className="flex items-center gap-2 text-sm">
                        Start for {waiting.length} sign-up{waiting.length === 1 ? "" : "s"}?
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={startAll}
                          className="rounded bg-utd-green px-3 py-1.5 font-medium text-white hover:bg-utd-green-dark disabled:opacity-60"
                        >
                          {busy === "bulk" ? "Starting…" : "Yes, start"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(false)}
                          className="rounded border border-line px-3 py-1.5 hover:border-ink"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!selectionOpen || waiting.length === 0 || busy !== null}
                        onClick={() => setConfirming(true)}
                        className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
                      >
                        Start for all {waiting.length} waiting
                      </button>
                    )}
                    {!selectionOpen && (
                      <span className="text-xs text-muted">
                        Opens after the sign-up deadline ({formatDate(current.signupDeadline)}).
                      </span>
                    )}
                  </div>
                  {notice && (
                    <p role="status" className="mt-3 text-sm text-utd-green-dark">
                      {notice}
                    </p>
                  )}
                  {actionError && (
                    <p role="alert" className={errorBox}>
                      {actionError}
                    </p>
                  )}
                </div>

                {rows.length === 0 ? (
                  <p className="mt-4 rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                    No sign-ups in {formatTerm(current)} yet.
                  </p>
                ) : (
                  <>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by professor or course"
                      aria-label="Search sign-ups"
                      className="w-full max-w-sm rounded border border-line bg-white px-3 py-2 text-sm"
                    />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      aria-label="Filter by status"
                      className="rounded border border-line bg-white px-3 py-2 text-sm"
                    >
                      <option value="">All statuses</option>
                      {Object.entries(ASSESSMENT_STATUS).map(([value, entry]) => (
                        <option key={value} value={value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {shown.length === 0 ? (
                  <p className="mt-4 rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                    No sign-ups match these filters.
                  </p>
                  ) : (
                  <div className="relative mt-4 overflow-x-auto rounded border border-line bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line text-xs text-muted">
                        <tr>
                          <th className={th}>Professor</th>
                          <th className={th}>Course</th>
                          <th className={th}>Section · meets</th>
                          <th className={th}>Status</th>
                          <th className={th}>Observer selection</th>
                          <th className={th}>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((item) => {
                          const expanded = open === item.id
                          const canStart = item.status === "signed_up" && !item.candidateSummary
                          return (
                            <Fragment key={item.id}>
                              <tr className="border-b border-line last:border-0">
                                <td className={td}>
                                  <Link
                                    to={`/professors/${item.teacherId}`}
                                    className="font-medium text-utd-green hover:underline"
                                  >
                                    {fullName(item.teacher)}
                                  </Link>
                                  <span className="block text-muted">
                                    {formatRank(item.teacher.rank)} · {item.teacher.school}
                                  </span>
                                </td>
                                <td className={td}>
                                  {courseLabel(item.section.course)}
                                  <span className="block text-muted">{item.section.course.title}</span>
                                </td>
                                <td className={td}>
                                  Section {item.section.sectionNumber}
                                  <span className="block text-muted">{formatMeeting(item.section)}</span>
                                  <span className="block text-muted">{item.section.location ?? "—"}</span>
                                </td>
                                <td className={td}>
                                  <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                                  <span className="mt-1 block text-xs text-muted">
                                    Signed up {formatLocalDate(item.signedUpAt)}
                                  </span>
                                </td>
                                <td className={td}>
                                  <SelectionCell item={item} />
                                </td>
                                <td className={`${td} whitespace-nowrap`}>
                                  {canStart && (
                                    <button
                                      type="button"
                                      disabled={!item.selectionOpen || busy !== null}
                                      onClick={() => startOne(item)}
                                      title={
                                        item.selectionOpen
                                          ? undefined
                                          : `Opens after ${formatDate(item.signupDeadline)}`
                                      }
                                      className="mr-3 rounded border border-line px-3 py-1.5 text-xs font-medium hover:border-ink disabled:opacity-50"
                                    >
                                      {busy === item.id ? "Starting…" : "Start selection"}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    aria-expanded={expanded}
                                    onClick={() => setOpen(expanded ? null : item.id)}
                                    className="font-medium text-utd-green hover:underline"
                                  >
                                    {expanded ? "Hide" : "Details"}
                                  </button>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="border-b border-line bg-canvas last:border-0">
                                  <td colSpan={6} className="px-4 py-4">
                                    <Details id={item.id} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                  </>
                )}
              </>
            ) : (
              <p className="mt-3 rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                There are no terms taking sign-ups.
              </p>
            )}
          </>
        )}
      </StateBlock>
    </div>
  )
}

export default SignupReview
