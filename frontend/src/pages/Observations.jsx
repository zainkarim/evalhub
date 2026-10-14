import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import IncomingRequest from "../components/IncomingRequest"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  ALERT,
  ASSESSMENT_STATUS,
  courseLabel,
  formatDate,
  formatTerm,
  fullName,
  OBSERVATION_STATUS,
} from "../lib/format"
import { hasTeacherProfile, isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"
import { nextStep } from "../lib/workflow"

function Section({ title, hint, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

const th = "px-4 py-3 font-medium"
const td = "px-4 py-3"

// ------------------------------------------------------------- committee ----

function AllSignUps() {
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const call = useCallback(() => api.listAssessments({ status }), [status])
  const { data, error, loading, reload } = useApi(call)

  const text = search.trim().toLowerCase()
  const rows = (data?.data ?? []).filter(
    (item) =>
      !text ||
      `${fullName(item.teacher)} ${courseLabel(item.section.course)} ${item.section.course.title}`
        .toLowerCase()
        .includes(text),
  )

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by professor or course"
          aria-label="Search sign-ups"
          className="w-full max-w-sm rounded border border-line bg-white px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
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

      <div className="mt-6">
        <StateBlock
          loading={loading}
          error={error}
          onRetry={reload}
          empty={rows.length === 0}
          emptyMessage="No observation sign-ups match these filters."
        >
          <div className="relative overflow-x-auto rounded border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className={th}>Professor</th>
                  <th className={th}>Course</th>
                  <th className={th}>Status</th>
                  <th className={th}>Observer</th>
                  <th className={th}>Date</th>
                  <th className={th}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className={td}>
                      <Link
                        to={`/professors/${item.teacherId}`}
                        className="font-medium text-utd-green hover:underline"
                      >
                        {fullName(item.teacher)}
                      </Link>
                    </td>
                    <td className={td}>
                      {courseLabel(item.section.course)}
                      <span className="block text-muted">
                        {formatTerm(item.section.term)} · Section {item.section.sectionNumber}
                      </span>
                    </td>
                    <td className={td}>
                      <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                      {item.alert && (
                        <span
                          title={ALERT[item.alert].text}
                          className="mt-1 block text-xs font-medium text-utd-orange"
                        >
                          {ALERT[item.alert].label}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      {item.pairing && item.pairing.status !== "postponed"
                        ? fullName(item.pairing.observer)
                        : item.offer
                          ? fullName(item.offer.observer)
                          : "—"}
                      {item.offer && !["approved", "completed"].includes(item.pairing?.status) && (
                        <span className="block text-xs text-muted">Waiting for reply</span>
                      )}
                      {item.pairing?.isAcStepin && (
                        <span className="block text-xs text-muted">Committee step-in</span>
                      )}
                    </td>
                    <td className={td}>
                      {item.pairing?.status === "postponed" ? "—" : formatDate(item.pairing?.scheduledDate)}
                    </td>
                    <td className={td}>
                      <Link
                        to={`/assessments/${item.id}`}
                        className="whitespace-nowrap font-medium text-utd-green hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </div>
    </>
  )
}

// --------------------------------------------------------------- professor --

function ObservationRows({ rows, mode }) {
  return (
    <div className="relative overflow-x-auto rounded border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th className={th}>Course</th>
            <th className={th}>{mode === "given" ? "Observing" : "Observer"}</th>
            <th className={th}>Date</th>
            <th className={th}>Status</th>
            <th className={th}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((observation) => (
            <tr key={observation.id} className="border-b border-line last:border-0">
              <td className={td}>
                {courseLabel(observation.section.course)}
                <span className="block text-muted">
                  {formatTerm(observation.section.term)} · Section{" "}
                  {observation.section.sectionNumber}
                </span>
              </td>
              <td className={td}>
                {fullName(mode === "given" ? observation.observee : observation.observer)}
              </td>
              <td className={td}>{formatDate(observation.scheduledDate)}</td>
              <td className={td}>
                <StatusBadge status={observation.status} map={OBSERVATION_STATUS} />
                {observation.status === "approved" && (
                  <span className="mt-1 block text-xs text-muted">
                    {(mode === "given"
                      ? observation.observerSignedOffAt
                      : observation.observeeSignedOffAt)
                      ? "You signed off"
                      : "Your sign-off is pending"}
                  </span>
                )}
              </td>
              <td className={td}>
                <Link
                  to={`/records/${observation.id}`}
                  className="whitespace-nowrap font-medium text-utd-green hover:underline"
                >
                  {observation.status === "approved" ? "Sign off" : "View"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MyActivity({ user }) {
  const call = useCallback(async () => {
    const [signUps, incoming, observations] = await Promise.all([
      api.myAssessments(),
      api.incomingRequests(),
      api.listObservations(),
    ])
    const mine = (observations.data ?? []).filter((item) =>
      [item.observer.id, item.observee.id].includes(user.teacherId),
    )
    return {
      signUps: signUps.data ?? [],
      incoming: incoming.data ?? [],
      given: mine.filter((item) => item.observer.id === user.teacherId),
      received: mine.filter((item) => item.observee.id === user.teacherId),
    }
  }, [user.teacherId])
  const { data, error, loading, reload } = useApi(call)

  return (
    <StateBlock loading={loading} error={error} onRetry={reload}>
      {data && (
        <>
          <Section
            title="My sign-ups"
            hint="Each section you've signed up for, and what happens next."
          >
            {data.signUps.length === 0 ? (
              <p className="rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                You haven&apos;t signed up for an observation yet.
              </p>
            ) : (
              <div className="relative overflow-x-auto rounded border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th className={th}>Course</th>
                      <th className={th}>Status</th>
                      <th className={th}>Next step</th>
                      <th className={th}>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.signUps.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0">
                        <td className={td}>
                          {courseLabel(item.section.course)}
                          <span className="block text-muted">
                            {formatTerm(item.section.term)} · Section {item.section.sectionNumber}
                          </span>
                        </td>
                        <td className={td}>
                          <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                        </td>
                        <td className={td}>{nextStep(item)}</td>
                        <td className={td}>
                          <Link
                            to={`/assessments/${item.id}`}
                            className="whitespace-nowrap font-medium text-utd-green hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section
            title="Requests to observe a colleague"
            hint="Colleagues from your school who picked you as their observer. Each request offers several dates: confirm one, or decline. Requests expire after 48 hours."
          >
            {data.incoming.length === 0 ? (
              <p className="rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                No one has asked you to observe a class.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded border border-line bg-white">
                {data.incoming.map((request) => (
                  <IncomingRequest key={request.id} request={request} onChanged={reload} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Observations I'm giving"
            hint="Classes you have agreed to observe. Sign off after the class takes place."
          >
            {data.given.length === 0 ? (
              <p className="rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                You aren&apos;t observing anyone right now.
              </p>
            ) : (
              <ObservationRows rows={data.given} mode="given" />
            )}
          </Section>

          <Section
            title="Observations I'm receiving"
            hint="Colleagues observing your classes. You can see who and when."
          >
            {data.received.length === 0 ? (
              <p className="rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                No one is observing your classes yet.
              </p>
            ) : (
              <ObservationRows rows={data.received} mode="received" />
            )}
          </Section>
        </>
      )}
    </StateBlock>
  )
}

// ------------------------------------------------------------------ page ----

function Observations() {
  const { user } = useAuth()
  const committee = isAC(user)
  const mine = hasTeacherProfile(user)
  const [tab, setTab] = useState(committee ? "all" : "mine")

  const tabs = [
    { id: "all", label: "All sign-ups" },
    { id: "mine", label: "My observations" },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {committee ? "Observation Requests" : "My Observations"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {committee
              ? "Every faculty sign-up, its observer and its status. Start observer selection and review alerts on the Sign-up review page."
              : "Your sign-ups, requests from colleagues, and the observations you give and receive."}
          </p>
        </div>

        {(mine || committee) && (
          <Link
            to="/observation-signup"
            className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark"
          >
            {committee ? "Sign up a professor" : "Request Observation"}
          </Link>
        )}
      </div>

      {committee && mine && (
        <div className="mt-6 flex gap-6 border-b border-line text-sm" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 pb-2 ${
                tab === item.id
                  ? "border-utd-green text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {committee && (!mine || tab === "all") ? (
        <AllSignUps />
      ) : (
        <MyActivity user={user} />
      )}
    </div>
  )
}

export default Observations
