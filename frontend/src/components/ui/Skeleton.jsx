import { Card } from "./Card"
import { cx } from "./cx"

// The grey pulsing blocks are decoration (aria-hidden). Each group announces one
// "Loading…" to screen readers instead. The pulse stops under reduced motion via
// the global rule in index.css.
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded bg-line/80", className)} />
}

function Lines({ lines, className }) {
  return (
    <div className={cx("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cx("h-3", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  )
}

function Status({ className, children }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  )
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <Status className={className}>
      <Lines lines={lines} />
    </Status>
  )
}

// A table or list row: avatar-sized block plus two lines.
export function SkeletonRow({ className }) {
  return (
    <Status className={cx("flex items-center gap-4 py-3", className)}>
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </Status>
  )
}

export function SkeletonCard({ lines = 3, className }) {
  return (
    <Card className={className}>
      <Status>
        <Skeleton className="mb-4 h-4 w-1/3" />
        <Lines lines={lines} />
      </Status>
    </Card>
  )
}
