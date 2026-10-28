import { useCallback, useState } from "react"
import { Link, useParams } from "react-router-dom"
import AttemptHistory from "../components/AttemptHistory"
import ObservationFeedback from "../components/ObservationFeedback"
import ObservationResults from "../components/ObservationResults"
import PostponeControl from "../components/PostponeControl"
import SectionInfo, { Field } from "../components/SectionInfo"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Label,
  PageHeader,
  Textarea,
} from "../components/ui"
import { useToast } from "../components/ui/toast-context"
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
    <div className="rounded-card border border-line bg-surface-2 px-4 py-3 text-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-medium">{name}</p>
      <p className={at ? "mt-1 text-success" : "mt-1 text-muted"}>
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
  const toast = useToast()
  const call = useCallback(() => api.getObservation(id), [id])
  const { data: observation, error, loading, reload } = useApi(call)

  const [confirmed, setConfirmed] = useState(false)
  const [confirmingSignOff, setConfirmingSignOff] = useState(false)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState("")

  const run = async (action, message) => {
    setBusy(true)
    setActionError("")
    try {
      await action()
      setConfirmed(false)
      if (message) toast.success(message)
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
  // Observation form (#33): the observer fills it in until they sign off; the
  // The observer can review their answers. The observee sees ratings
  // after the observer signs; the committee retains its access.
  const formOpen = isObserver && status === "approved" && !observation?.observerSignedOffAt
  const observerSigned = Boolean(observation?.observerSignedOffAt)
  const canViewResults = committee || isObserver || (isObservee && observerSigned)

  const doSignOff = () =>
    run(
      () => api.signOffObservation(observation.id, isObservee ? comment : undefined),
      "You signed off on this observation.",
    )

  return (
    <div className="space-y-6">
      <PageHeader
        backTo={{ to: "/observations", label: "Back to observations" }}
        title="Observation record"
        subtitle={
          observation
            ? `${courseLabel(observation.section.course)} · ${observation.section.course.title}`
            : undefined
        }
        action={observation && <StatusBadge status={status} map={OBSERVATION_STATUS} />}
      />

      <StateBlock loading={loading} error={error} onRetry={reload}>
        {observation && (
          <>
            {locked && (
              <Callout tone="success" title="This record is complete and view-only.">
                Once both people sign off, nobody — including the committee — can change it.
              </Callout>
            )}

            <SectionInfo section={observation.section} />

            <Card padded={false}>
              <CardHeader title="Who and when" />
              <CardBody className="pb-6">
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
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
                {(committee || isObservee) && (
                  <p className="mt-4 text-sm">
                    <Link
                      to={`/assessments/${observation.assessmentId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      View the full sign-up
                    </Link>
                  </p>
                )}
              </CardBody>
            </Card>

            {status !== "postponed" && (
              <Card padded={false}>
                <CardHeader title="Observation form" />
                <CardBody className="pb-6">
                  {formOpen ? (
                    dateArrived ? (
                      <>
                        <p className="mb-4 text-sm text-muted">
                          Rate each criterion and add your notes, then save. You can change
                          your answers until you sign off below.
                        </p>
                        <ObservationFeedback observationId={observation.id} />
                      </>
                    ) : (
                      <p className="text-sm text-muted">
                        The form opens on {formatDate(observation.scheduledDate)}, once the
                        class has taken place.
                      </p>
                    )
                  ) : canViewResults ? (
                    <>
                      {!observerSigned && (
                        <p className="mb-3 text-sm text-muted">
                          These ratings are not final until the observer signs off.
                        </p>
                      )}
                      <ObservationResults observationId={observation.id} />
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      The ratings become available once the observer signs off.
                    </p>
                  )}
                </CardBody>
              </Card>
            )}

            <Card padded={false}>
              <CardHeader title="Sign-off" />
              <CardBody className="pb-6">
                <div className="grid gap-3 sm:grid-cols-2">
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
                  <p className="mt-4 rounded-card border border-line bg-surface-2 px-4 py-3 text-sm">
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
                      if (confirmed && dateArrived) setConfirmingSignOff(true)
                    }}
                  >
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        disabled={!dateArrived}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <span>
                        {isObserver
                          ? `I observed this class on ${formatDate(observation.scheduledDate)} and have given my feedback.`
                          : `I confirm this observation took place on ${formatDate(observation.scheduledDate)}. Signing off does not mean I agree with the observer's ratings or comments.`}
                      </span>
                    </label>

                    {isObservee && (
                      <div className="mt-4">
                        <Label htmlFor="perspective">Your perspective (optional)</Label>
                        <Textarea
                          id="perspective"
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          rows={3}
                          disabled={!dateArrived}
                          className="mt-2"
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

                    <Button
                      type="submit"
                      className="mt-4"
                      disabled={!confirmed || !dateArrived}
                      loading={busy}
                    >
                      {busy ? "Signing off…" : "Sign off"}
                    </Button>
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
              </CardBody>
            </Card>

            {canAct && (
              <Card padded={false}>
                <CardHeader
                  title="Plans changed?"
                  description="If the class can't be observed on this date, postpone this attempt. The reason is recorded, nothing is deleted, and a new attempt can be scheduled in the same semester."
                />
                <CardBody className="pb-6">
                  <PostponeControl
                    onSubmit={(reason) => api.postponeObservation(observation.id, reason)}
                    onDone={reload}
                  />
                </CardBody>
              </Card>
            )}

            {actionError && (
              <Callout tone="danger" role="alert">
                {actionError}
              </Callout>
            )}

            <AttemptHistory attempts={observation.attempts} />
          </>
        )}
      </StateBlock>

      <ConfirmDialog
        open={confirmingSignOff}
        title="Sign off on this observation?"
        description="Once both people have signed off, the record is complete and nobody can change it."
        confirmLabel="Sign off"
        onCancel={() => setConfirmingSignOff(false)}
        onConfirm={() => {
          setConfirmingSignOff(false)
          doSignOff()
        }}
      />
    </div>
  )
}

export default ObservationRecord
