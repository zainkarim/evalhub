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
import { SELECTION_COPY } from "../lib/workflow"
import { useApi } from "../lib/useApi"

const th = "px-4 py-3 font-medium"
const td = "px-4 py-3 align-top"
const errorBox = "mt-3 rounded border border-utd-orange/40 bg-surface px-3 py-2 text-sm"

function Heading({ title, count, hint }) {
  return (
    <div className="mt-10 first:mt-6">
      <h2 className="text-sm font-semibold">
        {title}
        {count > 0 && (
          <span className="ml-2 rounded-full bg-utd-orange px-2 py-0.5 text-[11px] font-semibold text-accent-fg">
            {count}
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  )
}

// Observer pool alerts: nobody eligible (urgent) or a short list (limited pool).
function Alerts({ alerts, started }) {
  if (alerts.length === 0) {
    return (
      <p className="mt-3 rounded border border-line bg-surface px-5 py-6 text-sm text-muted">
        {started
          ? "No alerts. Every sign-up has a full list."
          : "No alerts yet. They appear once observer selection has run."}
      </p>
    )
  }
  return (
    <ul className="mt-3 divide-y divide-line rounded border border-line bg-surface">
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
            Open sign-up
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

const DATE_FIELDS = [
  ["signupDeadline", "Sign-up deadline", "Everyone who is due signs up by this date."],
  ["observationDeadline", "Observation-period deadline", "Observations should be completed by this date."],
  ["feedbackDeadline", "Feedback / survey deadline", "Observees take the end-of-process survey by this date."],
]

// The three dates of the term's cycle. The committee can change them.
function CycleDates({ term, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const startEditing = () => {
    setValues({
      signupDeadline: toDateOnly(term.signupDeadline) ?? "",
      observationDeadline: toDateOnly(term.observationDeadline) ?? "",
      feedbackDeadline: toDateOnly(term.feedbackDeadline) ?? "",
    })
    setError("")
    setEditing(true)
  }

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await api.updateTermDates(term.id, values)
      setEditing(false)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const state = (date) => {
    if (!date) return "Not set"
    return todayISO() > toDateOnly(date) ? "Passed" : "Upcoming"
  }

  return (
    <section className="mt-4 rounded border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Cycle dates · {formatTerm(term)}</h3>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded border border-line px-3 py-1.5 text-xs font-medium hover:border-ink"
          >
            Edit dates
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {DATE_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label htmlFor={key} className="block text-xs text-muted">
                  {label}
                </label>
                <input
                  id={key}
                  type="date"
                  required
                  value={values[key] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-utd-green px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save dates"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className={errorBox}>
              {error}
            </p>
          )}
        </form>
      ) : (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          {DATE_FIELDS.map(([key, label, hint]) => (
            <div key={key}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-0.5 font-medium">
                {formatDate(term[key])}{" "}
                <span className="text-xs font-normal text-muted">· {state(term[key])}</span>
              </dd>
              <dd className="text-xs text-muted">{hint}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function ObserverList({ item }) {
  if (!item.candidateSummary) return <span className="text-muted">Not started</span>
  if (item.observerList.length === 0) {
    return (
      <>
        <span className="text-muted">No eligible observers</span>
        {item.alert && (
          <span className="mt-1 block">
            <StatusBadge status={item.alert} map={ALERT} />
          </span>
        )}
      </>
    )
  }
  return (
    <>
      <ul className="space-y-0.5">
        {item.observerList.map((observer) => (
          <li key={observer.id}>{fullName(observer)}</li>
        ))}
      </ul>
      <span className="mt-1 block text-xs text-muted">
        {item.candidateSummary.poolSize} eligible · {item.candidateSummary.listSize} listed
      </span>
      {item.alert && (
        <span className="mt-1 block">
          <StatusBadge status={item.alert} map={ALERT} />
        </span>
      )}
    </>
  )
}

// The committee's page for the semester's cycle: its dates, the single Start
// Observer Selection action, alerts for empty or short observer pools, and a
// read-only view of every sign-up with Remind buttons. The "list is ready"
// message is sent automatically when a list is generated.
// The committee does not approve or release anything per sign-up.
function Cycle() {
  const [termId, setTermId] = useState(null)
  const [open, setOpen] = useState(null) // expanded sign-up id
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [busy, setBusy] = useState(null) // "start" | "remind-all" | sign-up id
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
  const alerts = (data?.alerts ?? []).filter((item) => item.dueTermId === current?.id)
  const started = Boolean(current?.selectionStartedAt)
  const deadlinePassed =
    !current?.signupDeadline || todayISO() > toDateOnly(current.signupDeadline)
  const stage = (status) => rows.filter((item) => normalizeStatus(item.status) === status).length
  const hasList = (item) => (item.candidateSummary?.listSize ?? 0) > 0
  // Still choosing: the only sign-ups a reminder makes sense for.
  const isChoosing = (item) => item.status === "candidates_generated" && hasList(item)
  const withLists = rows.filter(hasList).length
  const choosing = rows.filter(isChoosing)
  // Selection ran but nobody was eligible: Start can be pressed again to re-check.
  const emptyLists = rows.filter(
    (item) => item.status === "signed_up" && item.candidateSummary?.listSize === 0,
  )
  const canRecheck = started && emptyLists.length > 0
  const text = search.trim().toLowerCase()
  const shown = rows.filter(
    (item) =>
      (!statusFilter || normalizeStatus(item.status) === statusFilter) &&
      (!text ||
        `${fullName(item.teacher)} ${item.teacher.email} ${courseLabel(item.section.course)} ${item.section.course.title} ${item.section.sectionNumber}`
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
    }
  }

  const start = () =>
    run("start", async () => {
      const result = await api.startObserverSelection(current.id)
      const plural = (n) => `${n} sign-up${n === 1 ? "" : "s"}`
      if (result.alreadyStarted && result.started === 0) {
        setNotice(
          result.stillEmpty
            ? `Re-checked ${plural(result.stillEmpty)} with no list. Still no eligible observers; the committee stays alerted.`
            : "Observer selection had already started. Nothing changed.",
        )
        return
      }
      const parts = [`Observer lists built for ${plural(result.started)}.`]
      if (result.noEligible) parts.push(`${result.noEligible} with no eligible observer.`)
      if (result.limited) parts.push(`${result.limited} with a limited pool.`)
      if (result.stillEmpty) parts.push(`${result.stillEmpty} still with no eligible observer.`)
      setNotice(parts.join(" "))
    })

  const remind = (item) =>
    run(item.id, async () => {
      await api.remindListReady(current.id, [item.id])
      setNotice(`Reminded ${fullName(item.teacher)} to choose an observer.`)
    })

  const remindAll = () =>
    run("remind-all", async () => {
      const result = await api.remindListReady(current.id)
      setNotice(`Reminded ${result.sent} professor${result.sent === 1 ? "" : "s"} still choosing.`)
    })

  return (
    <div>
      <div className="sky-scrim w-fit max-w-full">
      <h1 className="text-2xl font-semibold tracking-tight">Cycle</h1>
      <p className="mt-1 text-sm text-muted">
        The semester&apos;s dates, the single Start Observer Selection button, alerts for empty or
        short observer pools, and every sign-up. Professors choose their own observer and send
        the request themselves; the committee approves nothing.
      </p>
      </div>

      <StateBlock loading={loading} error={error} onRetry={reload}>
        {data && current ? (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-4">
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
                    setActionError("")
                  }}
                  className="rounded border border-line bg-surface px-3 py-2 text-sm"
                >
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {formatTerm(term)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <CycleDates term={current} onChanged={reload} />

            <section className="mt-4 rounded border border-line bg-surface p-5">
              <h3 className="text-sm font-medium">Start Observer Selection</h3>
              <p className="mt-1 text-sm text-muted">
                {started
                  ? `Started on ${formatLocalDate(current.selectionStartedAt)}. ${withLists} of ${rows.length} sign-up${rows.length === 1 ? " has" : "s have"} a list.${emptyLists.length > 0 ? ` ${emptyLists.length} ${emptyLists.length === 1 ? "has" : "have"} no eligible observers yet (the committee is alerted below).` : ""}`
                  : `One click builds the list of up to five observers for every sign-up in ${formatTerm(current)} (${rows.length} so far). ${SELECTION_COPY.acButtonHint}`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={(started && !canRecheck) || !deadlinePassed || busy !== null}
                  onClick={start}
                  className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
                >
                  {busy === "start"
                    ? started
                      ? "Re-checking…"
                      : "Starting…"
                    : canRecheck
                      ? "Re-check empty lists"
                      : started
                        ? "Observer selection started"
                        : "Start Observer Selection"}
                </button>
                {deadlinePassed && current.signupDeadline && (
                  <span className="text-xs text-muted">
                    Sign-ups closed on {formatDate(current.signupDeadline)}. You can still sign a
                    professor up.
                  </span>
                )}
                {!started && !deadlinePassed && (
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
            </section>

            <Heading
              title="Observer pool alerts"
              count={alerts.length}
              hint="A sign-up whose eligible pool is empty (urgent) or smaller than five (limited pool)."
            />
            <Alerts alerts={alerts} started={started} />

            <Heading
              title="Sign-ups"
              count={0}
              hint="Read-only. Course, section, meeting time, the observee and, after selection, their list of up to five observers."
            />

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {[
                ["Signed up", rows.length],
                ["Choosing observer", stage("candidates_generated")],
                ["Scheduled", stage("approved")],
                ["Completed", stage("completed")],
                ["Postponed", stage("postponed")],
              ].map(([label, count]) => (
                <div key={label} className="rounded border border-line bg-surface px-4 py-3">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{count}</dd>
                </div>
              ))}
            </dl>

            {rows.length === 0 ? (
              <p className="mt-4 rounded border border-line bg-surface px-5 py-6 text-sm text-muted">
                No sign-ups in {formatTerm(current)} yet.
              </p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by professor, email or course"
                    aria-label="Search sign-ups"
                    className="w-full max-w-sm rounded border border-line bg-surface px-3 py-2 text-sm"
                  />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter by status"
                    className="rounded border border-line bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">All statuses</option>
                    {Object.entries(ASSESSMENT_STATUS).map(([value, entry]) => (
                      <option key={value} value={value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-muted">
                      {started
                        ? `${choosing.length} still choosing an observer`
                        : "Lists appear after Start Observer Selection"}
                    </span>
                    <button
                      type="button"
                      disabled={!started || choosing.length === 0 || busy !== null}
                      onClick={remindAll}
                      className="rounded border border-line px-3 py-1.5 text-sm font-medium hover:border-ink disabled:opacity-50"
                    >
                      {busy === "remind-all" ? "Sending…" : "Remind all"}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Professors are told automatically when their list is ready. Remind only nudges
                  those still choosing; nothing waits for it.
                </p>

                {shown.length === 0 ? (
                  <p className="mt-4 rounded border border-line bg-surface px-5 py-6 text-sm text-muted">
                    No sign-ups match these filters.
                  </p>
                ) : (
                  <div className="relative mt-4 overflow-x-auto rounded border border-line bg-surface">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line text-xs text-muted">
                        <tr>
                          <th className={th}>Course</th>
                          <th className={th}>Section · meets</th>
                          <th className={th}>Observee</th>
                          <th className={th}>Observer list</th>
                          <th className={th}>Status</th>
                          <th className={th}>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((item) => {
                          const expanded = open === item.id
                          return (
                            <Fragment key={item.id}>
                              <tr className="border-b border-line last:border-0">
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
                                  <Link
                                    to={`/professors/${item.teacherId}`}
                                    className="font-medium text-utd-green hover:underline"
                                  >
                                    {fullName(item.teacher)}
                                  </Link>
                                  <span className="block text-muted">{item.teacher.email}</span>
                                </td>
                                <td className={td}>
                                  <ObserverList item={item} />
                                </td>
                                <td className={td}>
                                  <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                                  <span className="mt-1 block text-xs text-muted">
                                    Signed up {formatLocalDate(item.signedUpAt)}
                                  </span>
                                </td>
                                <td className={`${td} whitespace-nowrap`}>
                                  {item.listReadyNotifiedAt && (
                                    <span className="mr-3 text-xs text-muted">
                                      Notified {formatLocalDate(item.listReadyNotifiedAt)}
                                    </span>
                                  )}
                                  {isChoosing(item) && (
                                    <button
                                      type="button"
                                      disabled={busy !== null}
                                      onClick={() => remind(item)}
                                      className="mr-3 rounded border border-line px-3 py-1.5 text-xs font-medium hover:border-ink disabled:opacity-50"
                                    >
                                      {busy === item.id ? "Sending…" : "Remind"}
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
          data && (
            <p className="mt-6 rounded border border-line bg-surface px-5 py-6 text-sm text-muted">
              There are no terms taking sign-ups.
            </p>
          )
        )}
      </StateBlock>
    </div>
  )
}

export default Cycle
