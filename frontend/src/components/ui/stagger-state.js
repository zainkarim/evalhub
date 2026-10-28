// What the list entrance (Stagger.jsx) has already animated on this page. Cleared
// by Layout when the route changes, so a new page animates again.
export const seen = new Set()

export function resetStagger() {
  seen.clear()
}
