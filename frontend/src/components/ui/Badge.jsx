import { cx } from "./cx"

// Same pill shape as StatusBadge: soft tinted background, matching text, a thin
// inset ring so it holds up on both surfaces.
const TONES = {
  neutral: { pill: "bg-surface-2 text-muted ring-line", dot: "bg-muted" },
  success: { pill: "bg-success-soft text-success ring-success/30", dot: "bg-success" },
  warning: { pill: "bg-warning-soft text-warning ring-warning/30", dot: "bg-warning" },
  danger: { pill: "bg-danger-soft text-danger ring-danger/30", dot: "bg-danger" },
  info: { pill: "bg-info-soft text-info ring-info/30", dot: "bg-info" },
  accent: { pill: "bg-accent-soft text-accent-ink ring-accent/30", dot: "bg-accent" },
  // The one solid badge: a completed record is final and locked.
  solid: { pill: "bg-primary text-primary-fg ring-primary", dot: "bg-primary-fg" },
}

const SIZES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-0.5 text-xs",
}

function Badge({ tone = "neutral", size = "md", dot = false, className, children }) {
  const colors = TONES[tone] ?? TONES.neutral
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
        colors.pill,
        SIZES[size],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cx("h-1.5 w-1.5 rounded-full", colors.dot)} />}
      {children}
    </span>
  )
}

export default Badge
