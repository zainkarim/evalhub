import { useCallback } from "react"
import { Link } from "react-router-dom"
import ReviewControls from "../components/ReviewControls"
import StateBlock from "../components/StateBlock"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  ATTENTION,
  courseLabel,
  formatDate,
  formatMeeting,
  formatRank,
  formatTerm,
  fullName,
} from "../lib/format"
import { useApi } from "../lib/useApi"

const th = "px-4 py-3 font-medium"
const td = "px-4 py-3"

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

function ApprovalCard({ item, user, onDone }) {
  const source = item.isAcStepin
    ? "Committee step-in — assigned directly, not chosen from a candidate list."
    : item.sourceList
      ? `Requested by the professor from a list of ${item.sourceList.listSize} (${item.sourceList.poolSize} eligible); the observer accepted.`
      : "Chosen from the candidate list."

  return (
    <li className="rounded border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {fullName(item.observer)} <span className="text-muted">will observe</span>{" "}
            {fullName(item.observee)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {courseLabel(item.section.course)} · {item.section.course.title} · Section{" "}
            {item.section.sectionNumber} · {formatTerm(item.section.term)}
          </p>
        </div>
        <Link
          to={`/assessments/${item.assessmentId}`}
          className="text-sm font-medium text-utd-green hover:underline"
        >
          Open sign-up
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Observation date</dt>
          <dd className="mt-0.5">{formatDate(item.scheduledDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Class meets</dt>
          <dd className="mt-0.5">{formatMeeting(item.section)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Observer</dt>
          <dd className="mt-0.5">
            {formatRank(item.observer.rank)} · {item.observer.school}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">{source}</p>

      <div className="mt-5">
        <ReviewControls observation={item} user={user} onDone={onDone} />
      </div>
    </li>
  )
}

// The committee's working page: pairings to approve, sign-ups that need a
// committee member to step in, and approved observations still awaiting sign-off.
function Approvals() {
  const { user } = useAuth()
  const call = useCallback(() => api.assessmentQueue(), [])
  const { data: queue, error, loading, reload } = useApi(call)

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
      <p className="mt-1 text-sm text-muted">
        Nothing is final until the committee approves it, and the system never sends anything
        on its own.
      </p>

      <StateBlock loading={loading} error={error} onRetry={reload}>
        {queue && (
          <>
            <Heading
              title="Pairings awaiting approval"
              count={queue.counts.pendingApproval}
              hint="An observer has agreed to observe a class. Approve to make it official."
            />
            {queue.pendingApproval.length === 0 ? (
              <p className="mt-3 rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                No pairings are waiting for review.
              </p>
            ) : (
              <ul className="mt-3 space-y-4">
                {queue.pendingApproval.map((item) => (
                  <ApprovalCard key={item.id} item={item} user={user} onDone={reload} />
                ))}
              </ul>
            )}

            <Heading
              title="Needs committee attention"
              count={queue.counts.needsAttention}
              hint="No eligible observer, or the observation didn't happen. A committee member can step in or postpone."
            />
            {queue.needsAttention.length === 0 ? (
              <p className="mt-3 rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                Every sign-up is on track.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th className={th}>Professor</th>
                      <th className={th}>Course</th>
                      <th className={th}>Why</th>
                      <th className={th}>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.needsAttention.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0">
                        <td className={td}>
                          {fullName(item.teacher)}
                          <span className="block text-muted">{formatRank(item.teacher.rank)}</span>
                        </td>
                        <td className={td}>
                          {courseLabel(item.section.course)}
                          <span className="block text-muted">
                            {formatTerm(item.section.term)} · Section {item.section.sectionNumber}
                          </span>
                        </td>
                        <td className={`${td} max-w-xs`}>{ATTENTION[item.attention]}</td>
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

            <Heading
              title="Approved — awaiting sign-off"
              count={0}
              hint="Both the observer and the observee confirm after the class. Completed records can't be edited."
            />
            {queue.awaitingSignOff.length === 0 ? (
              <p className="mt-3 rounded border border-line bg-white px-5 py-6 text-sm text-muted">
                No approved observations are waiting on sign-off.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th className={th}>Course</th>
                      <th className={th}>Observer → Observee</th>
                      <th className={th}>Date</th>
                      <th className={th}>Sign-off</th>
                      <th className={th}>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.awaitingSignOff.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0">
                        <td className={td}>
                          {courseLabel(item.section.course)}
                          <span className="block text-muted">
                            {formatTerm(item.section.term)} · Section {item.section.sectionNumber}
                          </span>
                        </td>
                        <td className={td}>
                          {fullName(item.observer)} → {fullName(item.observee)}
                        </td>
                        <td className={td}>{formatDate(item.scheduledDate)}</td>
                        <td className={td}>
                          <span className="block text-xs">
                            Observer: {item.observerSignedOffAt ? "done" : "pending"}
                          </span>
                          <span className="block text-xs">
                            Observee: {item.observeeSignedOffAt ? "done" : "pending"}
                          </span>
                        </td>
                        <td className={td}>
                          <Link
                            to={`/records/${item.id}`}
                            className="whitespace-nowrap font-medium text-utd-green hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </StateBlock>
    </div>
  )
}

export default Approvals
