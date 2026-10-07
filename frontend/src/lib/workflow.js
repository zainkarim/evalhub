import { formatDate, fullName, normalizeStatus, timeLeft } from "./format"

// Requirements §4.3: sign up -> the committee starts observer selection ->
// the professor picks one observer + 4-8 dates -> the observer confirms one ->
// the class happens and both sign off. The committee never approves a pairing.
export const STEPS = ["Signed up", "Observer list", "Request sent", "Scheduled", "Sign-off"]

// Which step the sign-up is on. Returns STEPS.length once everything is done.
export function currentStep(assessment) {
  switch (normalizeStatus(assessment.status)) {
    case "signed_up":
      return 1
    case "candidates_generated":
      return assessment.offer ? 3 : 2
    case "approved":
      return 4
    case "completed":
      return STEPS.length
    default:
      return -1 // postponed / not eligible: no progress bar
  }
}

// One line telling the professor what happens next.
export function nextStep(assessment) {
  const { pairing, offer, alert, selectionOpen, signupDeadline } = assessment
  switch (normalizeStatus(assessment.status)) {
    case "signed_up":
      if (alert === "no_eligible_observers") {
        return "No eligible observers — the committee will assign one"
      }
      return selectionOpen
        ? "Waiting for the committee to start observer selection"
        : `Waiting for the committee to start observer selection (after ${formatDate(signupDeadline)})`
    case "candidates_generated":
      if (offer) {
        return `Waiting for ${fullName(offer.observer)} to confirm a date (${timeLeft(offer.expiresAt)})`
      }
      if (alert === "no_eligible_observers") {
        return "No eligible observers — the committee will assign one"
      }
      return "Your list is ready — choose one observer and offer 4–8 dates"
    case "approved":
      return pairing?.scheduledDate
        ? `Scheduled for ${formatDate(pairing.scheduledDate)}`
        : "Scheduled"
    case "completed":
      return "Complete — record is view-only"
    case "postponed":
      return "Postponed — schedule a new attempt"
    default:
      return "—"
  }
}
