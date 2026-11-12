import { CalendarCheck, CalendarX, Check, ChevronDown, ClipboardList, Filter } from "lucide-react"
import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { Button, Callout, Card, EmptyState, PageHeader, Skeleton, StaggerItem, TabPanel, Tabs } from "../components/ui"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  ASSESSMENT_STATUS,
  OBSERVATION_STATUS,
  OFFER_STATUS,
  formatDate,
  formatDateTime,
  fullName,
  todayISO,
  toDateOnly,
} from "../lib/format"
import {
  POSTPONED_BADGE,
  REQUEST_FILTERS,
  buildRequests,
  matchesFilter,
  signUpLabels,
  summarize,
} from "../lib/requestTracking"
import { isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"
import { nextStep } from "../lib/workflow"

// Issue #60: every observation request the professor sent, what happened to it,
// and the full attempt history. Read-only; actions stay on the sign-up page.

const STATS = [
  { id: "active", label: "Waiting for reply" },
  { id: "confirmed", label: "Confirmed" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "No response" },
  { id: "postponed", label: "Postponed" },
]

// Five small cards: one row from `sm` up; on phones two per row, the fifth full width.
const STATS_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-5"
const STAT_CARD =
  "rounded-card border border-line bg-surface p-3 shadow-xs max-sm:last:col-span-2 sm:p-4"

// Faculty can sign up for a current/upcoming Spring or Fall term until its sign-up
// deadline (the deadline day itself is open); the committee can always.
const signUpOpen = (term, committee) =>
  term.season !== "summer" &&
  toDateOnly(term.endDate) >= todayISO() &&
  (committee || !term.signupDeadline || todayISO() <= toDateOnly(term.signupDeadline))

// "Wed, Nov 4" for a date chip (the year is on the card already).
const shortDate = (day) => formatDate(day).replace(/, \d{4}$/, "")

// Sign-ups, then every sign-up's detail in parallel. One failed detail only marks
// its own card; the page still loads.
async function loadRequests(committee) {
  const mine = await api.myAssessments()
  // Newest term first (the current sign-up on top); the sign-up time when the term
  // isn't known (the real backend's flat rows).
  const order = (item) => String(item.section?.term?.startDate ?? item.signedUpAt ?? "")
  const signUps = (mine?.data ?? []).slice().sort((a, b) => order(b).localeCompare(order(a)))
  const cards = await Promise.all(
    signUps.map((item) =>
      api.getAssessment(item.id).then(
        (detail) => ({ item: { ...item, ...detail }, detail, requests: buildRequests(detail), error: null }),
        (error) => ({ item, detail: null, requests: [], error }),
      ),
    ),
  )
  // Only needed for the empty state's "Sign up" link.
  let canSignUp = false
  if (cards.length === 0) {
    const terms = await api.listTerms().catch(() => null)
    canSignUp = (terms?.data ?? []).some((term) => signUpOpen(term, committee))
  }
  return { cards, canSignUp }
}

function LoadingCards() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className={STATS_GRID}>
        {STATS.map((stat) => (
          <div key={stat.id} className={STAT_CARD}>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="mt-3 h-6 w-8" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-card" />
      {[0, 1].map((card) => (
        <div key={card} className="rounded-card border border-line bg-surface p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          {[0, 1].map((row) => (
            <div key={row} className="mt-6 space-y-2 border-t border-line pt-4">
              <Skeleton className="h-3 w-1/5" />
              <Skeleton className="h-4 w-2/5" />
              <div className="flex gap-2 pt-1">
                {[0, 1, 2, 3].map((chip) => (
                  <Skeleton key={chip} className="h-6 w-20 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Stats({ counts }) {
  return (
    <dl className={STATS_GRID}>
      {STATS.map((stat) => (
        <div key={stat.id} className={STAT_CARD}>
          <dt className="text-sm text-muted">{stat.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{counts[stat.id]}</dd>
        </div>
      ))}
    </dl>
  )
}

// When things happened to the request, in the order they happened.
function timeline(request) {
  const parts = []
  if (request.kind === "assigned") {
    parts.push(request.assignedByCommittee ? "Assigned by the committee" : "Scheduled without a request on record")
  } else if (request.sentAt && request.kind === "request") {
    parts.push(`Sent ${formatDateTime(request.sentAt)}`)
  }
  const replied = request.respondedAt && formatDateTime(request.respondedAt)
  switch (request.offerStatus) {
    case "pending":
      if (request.expiresAt) parts.push(`Expires ${formatDateTime(request.expiresAt)}`)
      break
    case "confirmed":
      if (replied) parts.push(`Confirmed ${replied}`)
      break
    case "declined":
      if (replied) parts.push(`Declined ${replied}`)
      break
    case "expired":
      if (request.expiresAt) parts.push(`No reply by ${formatDateTime(request.expiresAt)}`)
      break
    case "withdrawn":
      if (replied) parts.push(`Withdrawn ${replied}`)
      break
    default:
  }
  if (request.status === "postponed" && request.postponedAt) {
    parts.push(`Postponed ${formatDateTime(request.postponedAt)}`)
  }
  return parts.join(" · ")
}

function DateChips({ dates }) {
  if (dates.length === 0) return null
  // One time range for the whole list when every date shares it (the usual case).
  const ranges = new Set(dates.map((date) => date.timeRange))
  const shared = ranges.size === 1 ? dates[0].timeRange : ""
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted">
        Proposed dates{shared && <span className="font-normal"> · {shared}</span>}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Proposed dates">
        {dates.map((date) => (
          <li
            key={date.id}
            className={
              date.isConfirmed
                ? "inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-fg ring-1 ring-primary-ink"
                : "inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink ring-1 ring-inset ring-line"
            }
          >
            {date.isConfirmed && <Check aria-hidden="true" className="h-3 w-3" />}
            {shortDate(date.date)}
            {!shared && date.timeRange && <span className="opacity-80"> · {date.timeRange}</span>}
            {date.isConfirmed && <span className="sr-only"> (confirmed)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RequestRow({ request }) {
  const postponed = request.status === "postponed"
  const when = timeline(request)
  const time = request.dates.find((date) => date.isConfirmed)?.timeRange
  return (
    <li className="border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">Attempt {request.attemptNo}</p>
          <h3 className="mt-0.5 font-medium">
            {request.observer ? fullName(request.observer) : "No observer chosen"}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {request.offerStatus ? (
            <StatusBadge status={request.offerStatus} map={OFFER_STATUS} />
          ) : (
            request.observationStatus &&
            request.observationStatus !== "postponed" && (
              <StatusBadge status={request.observationStatus} map={OBSERVATION_STATUS} />
            )
          )}
          {request.offerStatus && request.observationStatus === "completed" && (
            <StatusBadge status="completed" map={OBSERVATION_STATUS} />
          )}
          {postponed && <StatusBadge status="postponed" map={POSTPONED_BADGE} />}
        </div>
      </div>

      {when && <p className="mt-1 text-sm text-muted">{when}</p>}

      {request.confirmedDate &&
        (postponed ? (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-ink ring-1 ring-inset ring-warning/30">
            <CalendarX aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Was confirmed for <strong className="font-semibold">{formatDate(request.confirmedDate)}</strong>,
              then postponed. A new attempt starts with new dates.
            </span>
          </p>
        ) : (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-success-soft px-3 py-2 text-sm ring-1 ring-inset ring-success/30">
            <span className="inline-flex items-center gap-2 font-semibold text-success">
              <CalendarCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
              {request.observationStatus === "completed" ? "Observed on" : "Confirmed for"}{" "}
              {formatDate(request.confirmedDate)}
              {time && <span className="font-normal"> · {time}</span>}
            </span>
            {request.observationId && (
              <Link
                to={`/records/${request.observationId}`}
                className="font-medium text-primary-ink underline-offset-2 hover:underline"
              >
                Open record
              </Link>
            )}
          </p>
        ))}

      <DateChips dates={request.dates} />

      {request.reason && !postponed && <p className="mt-3 text-sm">Why: {request.reason}</p>}
      {postponed && request.postponeReason && (
        <p className="mt-3 text-sm">Why it was postponed: {request.postponeReason}</p>
      )}
    </li>
  )
}

function History({ detail }) {
  return (
    <details className="group border-t border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-b-card px-6 py-3 text-sm font-medium text-ink hover:bg-surface-2 focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
        Full history
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 text-muted transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pb-4 sm:px-6 sm:pb-6 [&>section]:mt-0 [&>section]:bg-surface-2/40 [&>section]:shadow-none max-sm:[&>section]:p-4">
        {Array.isArray(detail?.attempts) ? (
          <AttemptHistory attempts={detail.attempts} headingAs="h3" />
        ) : (
          <p className="text-sm text-muted">The server doesn't send the attempt history yet.</p>
        )}
      </div>
    </details>
  )
}

function SignUpCard({ card, filter, index }) {
  const { item, detail, requests, error } = card
  const labels = signUpLabels(item)
  const shown = requests.filter((request) => matchesFilter(request, filter))
  const headingId = `signup-${item.id}`
  return (
    <StaggerItem scope={`requests-${filter}`} index={index}>
      {/* Named by the course and the term/section line: the same course can appear twice. */}
      <Card as="section" padded={false} aria-labelledby={`${headingId} ${headingId}-term`}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 pt-6">
          <div className="min-w-0">
            <h2 id={headingId} className="text-base font-semibold">
              {labels.course}
              {labels.title && <span className="font-normal text-muted"> · {labels.title}</span>}
            </h2>
            <p id={`${headingId}-term`} className="mt-1 text-sm text-muted">
              {[labels.term, labels.section].filter(Boolean).join(" · ") || "Term not listed"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {item.status && <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />}
            <Link
              to={`/assessments/${item.id}`}
              className="text-sm font-medium text-primary-ink underline-offset-2 hover:underline"
            >
              Open sign-up
            </Link>
          </div>
        </div>

        <div className="px-6 py-5">
          {error ? (
            <Callout tone="danger" title="This sign-up's requests couldn't be loaded">
              {error.message}
            </Callout>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted">
              No requests sent yet. {item.status ? nextStep(item) : ""}
            </p>
          ) : (
            <ul>
              {shown.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </ul>
          )}
        </div>

        {!error && <History detail={detail} />}
      </Card>
    </StaggerItem>
  )
}

function RequestTracking() {
  const { user } = useAuth()
  const committee = isAC(user)
  const [filter, setFilter] = useState("all")
  const call = useCallback(() => loadRequests(committee), [committee])
  const { data, error, loading, reload } = useApi(call)

  const cards = data?.cards ?? []
  const counts = summarize(cards.flatMap((card) => card.requests))
  // Under a filter, only sign-ups with a matching request (a card that failed to
  // load is shown under "All" only).
  const visible = cards.filter((card) =>
    filter === "all" ? true : !card.error && card.requests.some((request) => matchesFilter(request, filter)),
  )
  const filterLabel = REQUEST_FILTERS.find((tab) => tab.id === filter)?.label

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Requests"
        subtitle="Every observation request you've sent, what happened to it, and the full history. Nothing is removed."
      />

      {loading ? (
        <LoadingCards />
      ) : (
        <StateBlock error={error} onRetry={reload}>
          {data &&
            (cards.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                titleAs="h2"
                title="You haven't signed up for an observation yet"
                text={
                  data.canSignUp
                    ? "Sign up for one of your sections. Requests you send to an observer will show up here."
                    : "Sign-ups are closed right now. Requests you send to an observer will show up here."
                }
                action={data.canSignUp && <Button to="/observation-signup">Sign up for an observation</Button>}
              />
            ) : (
              <>
                <Stats counts={counts} />
                <div>
                  <Tabs
                    tabs={REQUEST_FILTERS.map((tab) => ({ ...tab, count: counts[tab.id] }))}
                    value={filter}
                    onChange={setFilter}
                    ariaLabel="Filter requests"
                    idPrefix="requests"
                  />
                  <TabPanel id={filter} value={filter} idPrefix="requests" className="mt-6 space-y-6">
                    {visible.length === 0 ? (
                      <EmptyState
                        icon={Filter}
                        titleAs="p"
                        title={`No requests under "${filterLabel}"`}
                        text="Pick another filter, or All to see every request."
                      />
                    ) : (
                      visible.map((card, index) => (
                        <SignUpCard key={card.item.id} card={card} filter={filter} index={index} />
                      ))
                    )}
                  </TabPanel>
                </div>
              </>
            ))}
        </StateBlock>
      )}
    </div>
  )
}

export default RequestTracking
