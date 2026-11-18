import { cx } from "./cx"

// A surface for content. Plain use: <Card>…</Card> (padded). To use sections,
// pass padded={false} and compose CardHeader / CardBody / CardFooter, which carry
// their own padding.
export function Card({
  as: Tag = "div",
  padded = true,
  interactive = false,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cx(
        "rounded-card border border-line bg-surface shadow-xs",
        padded && "p-6",
        interactive &&
          "block transition-[color,background-color,border-color,opacity,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-ink hover:shadow-sm motion-reduce:hover:translate-y-0",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// `as` sets the heading level, so a card never breaks the page's heading order.
export function CardHeader({ title, description, action, as: Heading = "h2", className }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 px-6 pt-6", className)}>
      <div className="min-w-0">
        <Heading className="text-base font-semibold text-ink">{title}</Heading>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cx("px-6 py-4", className)}>{children}</div>
}

export function CardFooter({ className, children }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-end gap-2 rounded-b-card border-t border-line bg-surface-2/50 px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  )
}
