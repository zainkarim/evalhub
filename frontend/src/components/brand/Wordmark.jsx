// The EvalHub wordmark as live text (Space Grotesk 700), so the accessible name,
// copy/paste and search all read "EvalHub". The "H" of "Hub" is cut on purpose
// (.wm-h in index.css: the upper half of its right stem is missing).
//
//  compact: "Eval" in the ink colour, "Hub" in one flat orange. Header, footer.
//  medium:  same, but "Hub" gets the subtle orange gradient (no glow). Login card.
// The big hero title with the full silver/orange treatment lives in landing/Hero.jsx.
function Wordmark({ variant = "compact", className = "" }) {
  const gradient = variant === "medium"
  return (
    <span className={`font-display font-bold leading-none tracking-[-0.02em] ${className}`}>
      <span className="text-ink">Eval</span>
      {gradient ? (
        <>
          <span className="wm-letter wm-hub wm-h">H</span>
          <span className="wm-letter wm-hub">ub</span>
        </>
      ) : (
        <span className="text-hub">
          <span className="wm-letter wm-h">H</span>ub
        </span>
      )}
    </span>
  )
}

export default Wordmark
