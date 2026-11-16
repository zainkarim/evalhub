import { formatDate, fullName, normalizeStatus, timeLeft, todayISO, toDateOnly } from "./format"

// Requirements §4.3: sign up -> after the sign-up deadline the committee clicks
// Start Observer Selection once for the whole term -> the professor picks one
// observer + 4-8 dates -> the observer confirms one -> the class happens and both
// sign off. Nothing in this flow is approved by the committee.

// The one place the wording lives, so the pages can't drift apart.
export const SELECTION_COPY = {
  before: (deadline) =>
    `Observer selection opens after the sign-up deadline (${formatDate(deadline)}). You will get a notification when your list is ready.`,
  aboutToOpen:
    "Observer selection is about to open. You will get a notification when your list is ready.",
  listReady:
    "Your list is ready. Choose one observer and offer 4–8 dates, then send the request yourself.",
  acButtonHint: "Opens the list to professors. It does not approve any request.",
}

// Before the deadline passes, or after it but before the committee's click.
export const waitingCopy = (signupDeadline) =>
  signupDeadline && todayISO() <= toDateOnly(signupDeadline)
    ? SELECTION_COPY.before(signupDeadline)
    : SELECTION_COPY.aboutToOpen
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
  const { pairing, offer, alert, signupDeadline } = assessment
  switch (normalizeStatus(assessment.status)) {
    case "signed_up":
      if (alert === "no_eligible_observers") {
        return "No eligible observers — the committee will assign one"
      }
      return waitingCopy(signupDeadline)
    case "candidates_generated":
      if (offer) {
        return `Waiting for ${fullName(offer.observer)} to confirm a date (${timeLeft(offer.expiresAt)})`
      }
      if (alert === "no_eligible_observers") {
        return "No eligible observers — the committee will assign one"
      }
      return SELECTION_COPY.listReady
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
