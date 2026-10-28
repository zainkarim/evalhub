// The intro plays once per browser session. Storage can throw (private window,
// blocked site data); in that case the page just shows its final state.
const KEY = "evalhub-intro-seen"

export function introSeen() {
  try {
    return sessionStorage.getItem(KEY) === "1"
  } catch {
    return true
  }
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(KEY, "1")
  } catch {
    // Nothing to do: the intro may play again on the next visit.
  }
}
