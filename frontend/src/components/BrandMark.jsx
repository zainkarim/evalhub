import { Link } from "react-router-dom"

// The EvalHub logo: a UTD-green tile with an "E", then the wordmark. Pass `to`
// to make it a link (the header does); without it, it is a plain mark.
function BrandMark({ to, className = "" }) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-fg shadow-xs"
      >
        E
      </span>
      <span className="text-lg font-semibold tracking-tight text-ink">EvalHub</span>
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
