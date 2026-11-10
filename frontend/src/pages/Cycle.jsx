import { Fragment, useCallback, useState } from "react"
import { Link } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import ObserverSummary from "../components/ObserverSummary"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
  StaggerItem,
  Table,
  TableCard,
  Td,
  Th,
} from "../components/ui"
import { useToast } from "../components/ui/toast-context"
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

// Observer pool alerts: nobody eligible (urgent) or a short list (limited pool).
function Alerts({ alerts, started }) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        compact
        titleAs="p"
        title={started ? "No alerts" : "No alerts yet"}
        text={started ? "Every sign-up has a full list." : "They appear once observer selection has run."}
      />
    )
  }
  return (
    <ul className="divide-y divide-line rounded-card border border-line">
      {alerts.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 text-sm">
          <div className="min-w-0">
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
          <Button variant="secondary" size="sm" to={`/assessments/${item.id}`}>
            Open sign-up
          </Button>
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
          <AttemptHistory attempts={data.attempts} headingAs="h3" />
          <p className="mt-4">
            <Link to={`/assessments/${id}`} className="text-sm font-medium text-primary-ink hover:underline">
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
  const toast = useToast()
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
      toast.success("Cycle dates saved.")
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
    <Card padded={false}>
      <CardHeader
        title={`Cycle dates · ${formatTerm(term)}`}
        action={
          !editing && (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              Edit dates
            </Button>
          )
        }
      />
      <CardBody className="pb-6">
        {editing ? (
          <form onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-3">
              {DATE_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="date"
                    required
                    value={values[key] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-1.5"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="submit" variant="secondary" loading={busy}>
                Save dates
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
          </form>
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            {DATE_FIELDS.map(([key, label, hint]) => (
              <div key={key}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatDate(term[key])}{" "}
                  <span className="text-xs font-normal text-muted">· {state(term[key])}</span>
                </dd>
                <dd className="text-xs text-muted">{hint}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
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
  const toast = useToast()
  const [termId, setTermId] = useState(null)
  const [open, setOpen] = useState(null) // expanded sign-up id
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [busy, setBusy] = useState(null) // "start" | "remind-all" | sign-up id
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")
  const [confirmingStart, setConfirmingStart] = useState(false)

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

  const announce = (message) => {
    setNotice(message)
    toast.success(message)
  }

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
        announce(
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
      announce(parts.join(" "))
    })

  const remind = (item) =>
    run(item.id, async () => {
      await api.remindListReady(current.id, [item.id])
      announce(`Reminded ${fullName(item.teacher)} to choose an observer.`)
    })

  const remindAll = () =>
    run("remind-all", async () => {
      const result = await api.remindListReady(current.id)
      announce(`Reminded ${result.sent} professor${result.sent === 1 ? "" : "s"} still choosing.`)
    })

  // Starting for the first time is the one-way step, so it asks first; re-checking
  // empty lists does not.
  const onStartClick = () => (started ? start() : setConfirmingStart(true))

  const startButton =
    data && current ? (
      <Button
        disabled={(started && !canRecheck) || !deadlinePassed || busy !== null}
        loading={busy === "start"}
        onClick={onStartClick}
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
      </Button>
    ) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle"
        subtitle="The semester's dates, the single Start Observer Selection button, alerts for empty or short observer pools, and every sign-up. Professors choose their own observer and send the request themselves; the committee approves nothing."
        action={startButton}
      />

      <StateBlock loading={loading} error={error} onRetry={reload}>
        {data && current ? (
          <>
            <div>
              <Label htmlFor="term" className="sr-only">
                Term
              </Label>
              <Select
                id="term"
                value={current.id}
                onChange={(event) => {
                  setTermId(Number(event.target.value))
                  setOpen(null)
                  setNotice("")
                  setActionError("")
                }}
                className="w-auto min-w-48"
              >
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {formatTerm(term)}
                  </option>
                ))}
              </Select>
            </div>

            <StaggerItem scope="cycle" index={0}>
              <CycleDates term={current} onChanged={reload} />
            </StaggerItem>

            <StaggerItem scope="cycle" index={1}>
            <Card padded={false}>
              <CardHeader title="Start Observer Selection" />
              <CardBody className="pb-6">
                <p className="text-sm text-muted">
                  {started
                    ? `Started on ${formatLocalDate(current.selectionStartedAt)}. ${withLists} of ${rows.length} sign-up${rows.length === 1 ? " has" : "s have"} a list.${emptyLists.length > 0 ? ` ${emptyLists.length} ${emptyLists.length === 1 ? "has" : "have"} no eligible observers yet (the committee is alerted below).` : ""}`
                    : `One click builds the list of up to five observers for every sign-up in ${formatTerm(current)} (${rows.length} so far). ${SELECTION_COPY.acButtonHint}`}
                </p>
                {deadlinePassed && current.signupDeadline && (
                  <p className="mt-2 text-xs text-muted">
                    Sign-ups closed on {formatDate(current.signupDeadline)}. You can still sign a
                    professor up.
                  </p>
                )}
                {!started && !deadlinePassed && (
                  <p className="mt-2 text-xs text-muted">
                    Opens after the sign-up deadline ({formatDate(current.signupDeadline)}).
                  </p>
                )}
                {notice && (
                  <Callout tone="success" className="mt-4">
                    {notice}
                  </Callout>
                )}
                {actionError && (
                  <Callout tone="danger" role="alert" className="mt-4">
                    {actionError}
                  </Callout>
                )}
              </CardBody>
            </Card>
            </StaggerItem>

            <StaggerItem scope="cycle" index={2}>
            <Card padded={false}>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    Observer pool alerts
                    {alerts.length > 0 && <Badge tone="accent">{alerts.length}</Badge>}
                  </span>
                }
                description="A sign-up whose eligible pool is empty (urgent) or smaller than five (limited pool)."
              />
              <CardBody className="pb-6">
                <Alerts alerts={alerts} started={started} />
              </CardBody>
            </Card>
            </StaggerItem>

            <StaggerItem scope="cycle" index={3}>
            <Card padded={false}>
              <CardHeader
                title="Sign-ups"
                description="Read-only. Course, section, meeting time, the observee and, after selection, their list of up to five observers."
                action={
                  rows.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!started || choosing.length === 0 || busy !== null}
                      loading={busy === "remind-all"}
                      onClick={remindAll}
                    >
                      {busy === "remind-all" ? "Sending…" : "Remind all"}
                    </Button>
                  )
                }
              />
              <CardBody className="pb-6">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  {[
                    ["Signed up", rows.length],
                    ["Choosing observer", stage("candidates_generated")],
                    ["Scheduled", stage("approved")],
                    ["Completed", stage("completed")],
                    ["Postponed", stage("postponed")],
                  ].map(([label, count]) => (
                    <div key={label} className="rounded-card bg-surface-2 px-4 py-3">
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{count}</dd>
                    </div>
                  ))}
                </dl>

                {rows.length === 0 ? (
                  <EmptyState
                    className="mt-4"
                    compact
                    titleAs="p"
                    title={`No sign-ups in ${formatTerm(current)} yet`}
                  />
                ) : (
                  <>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by professor, email or course"
                        aria-label="Search sign-ups"
                        className="max-w-sm"
                      />
                      <Select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        aria-label="Filter by status"
                        className="w-auto"
                      >
                        <option value="">All statuses</option>
                        {Object.entries(ASSESSMENT_STATUS).map(([value, entry]) => (
                          <option key={value} value={value}>
                            {entry.label}
                          </option>
                        ))}
                      </Select>
                      <span className="ml-auto text-xs text-muted">
                        {started
                          ? `${choosing.length} still choosing an observer`
                          : "Lists appear after Start Observer Selection"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Professors are told automatically when their list is ready. Remind only nudges
                      those still choosing; nothing waits for it.
                    </p>

                    {shown.length === 0 ? (
                      <EmptyState className="mt-4" compact titleAs="p" title="No sign-ups match these filters" />
                    ) : (
                      <TableCard className="mt-4">
                        <Table minWidth="56rem">
                          <thead>
                            <tr>
                              <Th>Course</Th>
                              <Th>Section · meets</Th>
                              <Th>Observee</Th>
                              <Th>Observer list</Th>
                              <Th>Status</Th>
                              <Th>
                                <span className="sr-only">Actions</span>
                              </Th>
                            </tr>
                          </thead>
                          <tbody>
                            {shown.map((item) => {
                              const expanded = open === item.id
                              return (
                                <Fragment key={item.id}>
                                  <tr className="border-b border-line last:border-0">
                                    <Td>
                                      {courseLabel(item.section.course)}
                                      <span className="block text-muted">{item.section.course.title}</span>
                                    </Td>
                                    <Td>
                                      Section {item.section.sectionNumber}
                                      <span className="block text-muted">{formatMeeting(item.section)}</span>
                                      <span className="block text-muted">{item.section.location ?? "—"}</span>
                                    </Td>
                                    <Td>
                                      <Link
                                        to={`/professors/${item.teacherId}`}
                                        className="font-medium text-primary-ink hover:underline"
                                      >
                                        {fullName(item.teacher)}
                                      </Link>
                                      <span className="block break-words text-muted">{item.teacher.email}</span>
                                    </Td>
                                    <Td>
                                      <ObserverList item={item} />
                                    </Td>
                                    <Td>
                                      <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                                      <span className="mt-1 block text-xs text-muted">
                                        Signed up {formatLocalDate(item.signedUpAt)}
                                      </span>
                                    </Td>
                                    <Td className="whitespace-nowrap">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {item.listReadyNotifiedAt && (
                                          <span className="text-xs text-muted">
                                            Notified {formatLocalDate(item.listReadyNotifiedAt)}
                                          </span>
                                        )}
                                        {isChoosing(item) && (
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            disabled={busy !== null}
                                            loading={busy === item.id}
                                            onClick={() => remind(item)}
                                          >
                                            {busy === item.id ? "Sending…" : "Remind"}
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          aria-expanded={expanded}
                                          onClick={() => setOpen(expanded ? null : item.id)}
                                        >
                                          {expanded ? "Hide" : "Details"}
                                        </Button>
                                      </div>
                                    </Td>
                                  </tr>
                                  {expanded && (
                                    <tr className="border-b border-line bg-surface-2 last:border-0">
                                      <td colSpan={6} className="px-4 py-4">
                                        <Details id={item.id} />
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </Table>
                      </TableCard>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
            </StaggerItem>
          </>
        ) : (
          data && <EmptyState titleAs="p" title="There are no terms taking sign-ups" />
        )}
      </StateBlock>

      <ConfirmDialog
        open={confirmingStart}
        title="Start observer selection?"
        description={`This builds the observer list for every sign-up in ${current ? formatTerm(current) : "this term"}. Professors are told when their list is ready, and it can't be undone.`}
        confirmLabel="Start Observer Selection"
        onCancel={() => setConfirmingStart(false)}
        onConfirm={() => {
          setConfirmingStart(false)
          start()
        }}
      />
    </div>
  )
}

export default Cycle
