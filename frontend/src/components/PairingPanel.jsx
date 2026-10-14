import { Link } from "react-router-dom"
import {
  formatDate,
  formatDateTime,
  formatMeeting,
  fullName,
  OBSERVATION_STATUS,
} from "../lib/format"
import { Field } from "./SectionInfo"
import StatusBadge from "./StatusBadge"

// One observer ↔ observee attempt: who, when, and sign-off state. Scheduled is
// not Completed: Completed means the class happened and both signed off.
// Both professors see each other's names (full attribution both ways).
function PairingPanel({ observation, viewer, title = "Observer pairing" }) {
  const isParty = [observation.observer.id, observation.observee.id].includes(viewer?.teacherId)
  const action = observation.status === "approved" && isParty ? "Sign off" : "Open record"

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {title} · attempt {observation.attemptNo}
        </h2>
        <StatusBadge status={observation.status} map={OBSERVATION_STATUS} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
        <Field label="Observer">
          {fullName(observation.observer)}
          {observation.isAcStepin && (
            <span className="block text-xs text-muted">Committee step-in</span>
          )}
        </Field>
        <Field label="Being observed">{fullName(observation.observee)}</Field>
        <Field label="Observation date">
          {formatDate(observation.scheduledDate)}
          <span className="block text-xs text-muted">{formatMeeting(observation.section)}</span>
        </Field>
        <Field label="Observer sign-off">
          {observation.observerSignedOffAt ? formatDateTime(observation.observerSignedOffAt) : "Pending"}
        </Field>
        <Field label="Observee sign-off">
          {observation.observeeSignedOffAt ? formatDateTime(observation.observeeSignedOffAt) : "Pending"}
        </Field>
      </dl>

      {observation.status === "postponed" && (
        <p className="mt-4 rounded border border-line bg-canvas px-4 py-3 text-sm">
          This attempt was postponed. The reason is in the attempt history below.
        </p>
      )}

      {(isParty || viewer?.role !== "faculty") && (
        <Link
          to={`/records/${observation.id}`}
          className="mt-5 inline-block rounded border border-line px-4 py-2 text-sm font-medium text-utd-green hover:border-ink"
        >
          {action}
        </Link>
      )}
    </section>
  )
}

export default PairingPanel
