import { useCallback, useState } from "react"
import { Link, useParams } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import PostponeControl from "../components/PostponeControl"
import SectionInfo, { Field } from "../components/SectionInfo"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  courseLabel,
  formatDate,
  formatDateTime,
  fullName,
  OBSERVATION_STATUS,
  todayISO,
  toDateOnly,
} from "../lib/format"
import { isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"

function SignOffCard({ label, name, at }) {
  return (
    <div className="rounded border border-line bg-canvas px-4 py-3 text-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-medium">{name}</p>
      <p className={at ? "mt-1 text-utd-green-dark" : "mt-1 text-muted"}>
        {at ? `✓ Signed off ${formatDateTime(at)}` : "Not signed off yet"}
      </p>
    </div>
  )
}

// The observation record. Scheduled / Confirmed is not Completed: only the
// observer and observee can sign off, after the class; the committee and
// everyone else see a read-only record. Once both have signed, the record is
// locked for good. There is no committee approval step.
function ObservationRecord() {
  const { id } = useParams()
  const { user } = useAuth()
  const call = useCallback(() => api.getObservation(id), [id])
  const { data: observation, error, loading, reload } = useApi(call)

  const [confirmed, setConfirmed] = useState(false)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState("")

  const run = async (action) => {
    setBusy(true)
    setActionError("")
    try {
      await action()
      setConfirmed(false)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isObserver = observation?.observer.id === user?.teacherId
  const isObservee = observation?.observee.id === user?.teacherId
  const isParty = isObserver || isObservee
  const committee = isAC(user)

  const status = observation?.status
  const locked = status === "completed"
  const dateArrived = observation
    ? toDateOnly(observation.scheduledDate) <= todayISO()
    : false
  const mySignedOff = isObserver
    ? observation?.observerSignedOffAt
    : observation?.observeeSignedOffAt
  const canAct = observation && status === "approved" && (isParty || committee)

  return (
    <div>
      <Link to="/observations" className="text-sm text-muted hover:text-ink">
        Back to observations
      </Link>

      <div className="mt-4">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {observation && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Observation record
                  </h1>
                  <p className="mt-1 text-muted">
                    {courseLabel(observation.section.course)} · {observation.section.course.title}
                  </p>
                </div>
                <StatusBadge status={status} map={OBSERVATION_STATUS} />
              </div>

              {locked && (
                <p className="mt-5 rounded border border-line bg-white px-4 py-3 text-sm">
                  <span className="font-medium">This record is complete and view-only.</span>{" "}
                  Once both people sign off, nobody — including the committee — can change it.
                </p>
              )}

              <SectionInfo section={observation.section} className="mt-6" />

              <section className="mt-6 rounded border border-line bg-white p-6">
                <h2 className="text-sm font-semibold">Who and when</h2>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                  <Field label="Observer">
                    {fullName(observation.observer)}
                    {observation.isAcStepin && (
                      <span className="block text-xs text-muted">Committee step-in</span>
                    )}
                  </Field>
                  <Field label="Being observed">{fullName(observation.observee)}</Field>
                  <Field label="Observation date">{formatDate(observation.scheduledDate)}</Field>
                  <Field label="Attempt">{observation.attemptNo}</Field>
                </dl>
              </section>

              <section className="mt-6 rounded border border-line bg-white p-6">
                <h2 className="text-sm font-semibold">Sign-off</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SignOffCard
                    label="Observer"
                    name={fullName(observation.observer)}
                    at={observation.observerSignedOffAt}
                  />
                  <SignOffCard
                    label="Observee"
                    name={fullName(observation.observee)}
                    at={observation.observeeSignedOffAt}
                  />
                </div>

                {observation.observeeComment && (
                  <p className="mt-4 rounded border border-line bg-canvas px-4 py-3 text-sm">
                    <span className="font-medium">Observee&apos;s perspective:</span>{" "}
                    {observation.observeeComment}
                  </p>
                )}

                {status === "postponed" && (
                  <p className="mt-4 text-sm text-muted">
                    This attempt was postponed, so there is nothing to sign. The reason is in
                    the attempt history below.
                  </p>
                )}

                {canAct && isParty && !mySignedOff && (
                  <form
                    className="mt-5 border-t border-line pt-5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      run(() =>
                        api.signOffObservation(observation.id, isObservee ? comment : undefined),
                      )
                    }}
                  >
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        disabled={!dateArrived}
                        className="mt-1"
                      />
                      <span>
                        {isObserver
                          ? `I observed this class on ${formatDate(observation.scheduledDate)} and have given my feedback.`
                          : `I confirm this observation took place on ${formatDate(observation.scheduledDate)}. Signing off does not mean I agree with the observer's ratings or comments.`}
                      </span>
                    </label>

                    {isObservee && (
                      <div className="mt-4">
                        <label htmlFor="perspective" className="block text-sm font-medium">
                          Your perspective (optional)
                        </label>
                        <textarea
                          id="perspective"
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          rows={3}
                          disabled={!dateArrived}
                          className="mt-2 w-full rounded border border-line bg-white px-3 py-2 text-sm disabled:bg-gray-50"
                          placeholder="Add context or your own view of the observation."
                        />
                      </div>
                    )}

                    {!dateArrived && (
                      <p className="mt-3 text-sm text-muted">
                        Sign-off opens on {formatDate(observation.scheduledDate)}, once the
                        class has taken place.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={!confirmed || busy || !dateArrived}
                      className="mt-4 rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
                    >
                      {busy ? "Signing off…" : "Sign off"}
                    </button>
                    <p className="mt-2 text-xs text-muted">
                      After both of you sign off, this record can&apos;t be edited by anyone.
                    </p>
                  </form>
                )}

                {canAct && isParty && mySignedOff && (
                  <p className="mt-4 text-sm text-muted">
                    You&apos;ve signed off. Waiting for {isObserver ? "the observee" : "the observer"}.
                  </p>
                )}
                {canAct && !isParty && (
                  <p className="mt-4 text-sm text-muted">
                    The observer and the observee sign off on this record. The committee has
                    view-only access here.
                  </p>
                )}
              </section>

              {canAct && (
                <section className="mt-6 rounded border border-line bg-white p-6">
                  <h2 className="text-sm font-semibold">Plans changed?</h2>
                  <p className="mt-1 mb-3 text-sm text-muted">
                    If the class can&apos;t be observed on this date, postpone this attempt. The
                    reason is recorded, nothing is deleted, and a new attempt can be scheduled
                    in the same semester.
                  </p>
                  <PostponeControl
                    onSubmit={(reason) => api.postponeObservation(observation.id, reason)}
                    onDone={reload}
                  />
                </section>
              )}

              {actionError && (
                <p
                  role="alert"
                  className="mt-4 rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm"
                >
                  {actionError}
                </p>
              )}

              <AttemptHistory attempts={observation.attempts} />

              {(committee || isObservee) && (
                <p className="mt-6 text-sm">
                  <Link
                    to={`/assessments/${observation.assessmentId}`}
                    className="font-medium text-utd-green hover:underline"
                  >
                    View the full sign-up
                  </Link>
                </p>
              )}
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default ObservationRecord
