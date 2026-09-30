import { formatDate } from "./format"

export const STEPS = [
  "Signed up",
  "Choose observer",
  "Committee approval",
  "Observation",
  "Sign-off",
]

// Which step the sign-up is on. Returns STEPS.length once everything is done.
export function currentStep(assessment) {
  switch (assessment.status) {
    case "signed_up":
    case "candidates_generated":
      return 1
    case "pending_ac_approval":
      return 2
    case "approved": {
      const pairing = assessment.pairing
      return pairing?.observerSignedOffAt || pairing?.observeeSignedOffAt ? 4 : 3
    }
    case "completed":
      return STEPS.length
    default:
      return -1 // cancelled / postponed / not eligible: no progress bar
  }
}

// One line telling the professor what happens next.
export function nextStep(assessment) {
  const { status, pairing, requestSummary, attention } = assessment
  switch (status) {
    case "signed_up":
      return attention === "no_eligible_observers"
        ? "No eligible observers — the committee will step in"
        : "Find your observer candidates"
    case "candidates_generated":
      if (attention === "no_eligible_observers") {
        return "No eligible observers — the committee will step in"
      }
      if (requestSummary.pending > 0) {
        return `Waiting for ${requestSummary.pending} observer${requestSummary.pending > 1 ? "s" : ""} to respond`
      }
      if (attention === "observation_not_completed") {
        return "Observation didn't happen — send new requests"
      }
      if (attention === "requests_unanswered") return "No one accepted — send new requests"
      return "Choose who to ask"
    case "pending_ac_approval":
      return "Waiting for committee approval"
    case "approved":
      return pairing?.scheduledDate
        ? `Observation on ${formatDate(pairing.scheduledDate)}`
        : "Observation scheduled"
    case "completed":
      return "Complete — record is view-only"
    case "postponed":
      return "Postponed to a later semester"
    case "cancelled":
      return "Cancelled"
    default:
      return "—"
  }
}
