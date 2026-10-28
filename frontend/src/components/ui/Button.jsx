import { LoaderCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { cx } from "./cx"

// transition-colors would also fade the focus ring in from the text colour
// (outline-color), so the transition list is spelled out without it.
const BASE =
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-md border font-medium transition-[color,background-color,border-color,opacity,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100"

const VARIANTS = {
  primary: "border-transparent bg-primary text-primary-fg hover:bg-primary-hover",
  secondary: "border-line bg-surface text-ink hover:border-ink",
  ghost: "border-transparent bg-transparent text-ink hover:bg-surface-2",
  danger: "border-transparent bg-danger text-danger-fg hover:opacity-90",
}

const SIZES = {
  sm: "min-h-9 gap-1.5 px-3 text-sm",
  md: "min-h-10 gap-2 px-4 text-sm",
}

const ICON = "h-4 w-4 shrink-0"

// One button for the whole app. Use a single `primary` per view; secondary and
// ghost for the rest; `danger` only for destructive actions (confirm first).
// `to` renders a router <Link> with the same look. `loading` keeps the button's
// width and accessible name (the label is faded out, not removed) and blocks
// clicks without dropping keyboard focus. Icon-only buttons need an aria-label.
function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  to,
  fullWidth = false,
  disabled = false,
  type = "button",
  className,
  onClick,
  children,
  ref,
  ...rest
}) {
  const blocked = disabled || loading
  const classes = cx(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    disabled && "cursor-not-allowed opacity-50",
    loading && "cursor-progress",
    className,
  )

  const handleClick = (event) => {
    if (blocked) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  const content = (
    <>
      <span className={cx("inline-flex items-center gap-[inherit]", loading && "opacity-0")}>
        {Icon && <Icon aria-hidden="true" className={ICON} />}
        {children}
        {IconRight && <IconRight aria-hidden="true" className={ICON} />}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle aria-hidden="true" className={cx(ICON, "animate-spin")} />
        </span>
      )}
    </>
  )

  if (to !== undefined) {
    return (
      <Link
        ref={ref}
        to={to}
        className={classes}
        aria-disabled={blocked || undefined}
        aria-busy={loading || undefined}
        tabIndex={blocked ? -1 : undefined}
        onClick={handleClick}
        {...rest}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {content}
    </button>
  )
}

export default Button
