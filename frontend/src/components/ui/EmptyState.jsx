import { cx } from "./cx"

// "Nothing here yet", plus the one thing the person can do about it. Pass a
// single `action` (usually a Button). `compact` is for use inside a card.
function EmptyState({ icon: Icon, title, text, action, compact = false, titleAs: Title = "h3", className }) {
  return (
    <div
      className={cx(
        "rounded-card border border-dashed border-line bg-surface/60 text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
        className,
      )}
    >
      {Icon && (
        <span
          aria-hidden="true"
          className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted"
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <Title className="text-sm font-semibold text-ink">{title}</Title>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export default EmptyState
