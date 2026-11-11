import HComet from "./HComet"

// The EvalHub wordmark as live text (Space Grotesk 700), so the accessible name,
// copy/paste and search all read "EvalHub". The "H" of "Hub" is cut on purpose
// (.wm-h in index.css: the upper half of its right stem is missing), and a tiny
// shooting star (HComet) flies through the gap.
//
//  compact: "Eval" in the ink colour, "Hub" in one flat orange. Header, footer.
//  medium:  same, but "Hub" gets the subtle orange gradient (no glow). Login card.
//  tiny:    for text of about 20px and below: the comet is just a dot and a short tail.
// The big hero title with the full silver/orange treatment lives in landing/Hero.jsx.
function Wordmark({ variant = "compact", tiny = false, className = "" }) {
  const gradient = variant === "medium"
  const hub = (
    <>
      <span className="relative inline-block leading-none">
        <span className={`wm-letter wm-h ${gradient ? "wm-hub" : ""}`}>H</span>
        <HComet tiny={tiny} />
      </span>
      {gradient ? <span className="wm-letter wm-hub">ub</span> : "ub"}
    </>
  )
  return (
    <span className={`font-display font-bold leading-none tracking-[-0.02em] ${className}`}>
      <span className="text-ink">Eval</span>
      {gradient ? hub : <span className="text-hub">{hub}</span>}
    </span>
  )
}

export default Wordmark
