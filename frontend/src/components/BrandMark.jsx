import { Link } from "react-router-dom"
import LogoMark from "./brand/LogoMark"
import Wordmark from "./brand/Wordmark"

// Text size that sits well next to a mark of this size (header 32, footer 28).
const TEXT = { 28: "text-lg", 32: "text-xl", 44: "text-[2rem]" }

// The EvalHub logo: the mark (E, constellation, comet) and the live-text wordmark.
// Pass `to` to make it a link (the header does); without it, it is a plain mark.
// Its accessible name is the visible text, "EvalHub" (the mark is aria-hidden).
function BrandMark({ to, size = 32, variant = "compact", className = "" }) {
  const content = (
    <>
      <LogoMark size={size} />
      <Wordmark variant={variant} className={TEXT[size] ?? "text-xl"} />
    </>
  )
  const classes = `flex shrink-0 items-center gap-2.5 rounded-md ${className}`
  return to ? (
    <Link to={to} className={classes}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  )
}

export default BrandMark
