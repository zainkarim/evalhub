import { Inbox } from "lucide-react"
import { m } from "motion/react"
import { Button, Callout, EmptyState, Skeleton, SkeletonCard } from "./ui"

// Loading, error and empty states shared by every page, so they all look and
// behave the same. `skeleton` picks the loading shape: "card" (default), "table"
// (a card with a header and rows) or "form" (two columns of fields).
function LoadingShape({ skeleton }) {
  if (skeleton === "table") {
    return (
      <div role="status" className="rounded-card border border-line bg-surface p-4 shadow-xs">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-3 w-full" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="mt-4 flex items-center gap-4">
            <Skeleton className="h-3 w-1/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-1/5" />
          </div>
        ))}
      </div>
    )
  }
  if (skeleton === "form") {
    return (
      <div role="status" className="grid gap-4 rounded-card border border-line bg-surface p-6 shadow-xs sm:grid-cols-2">
        <span className="sr-only">Loading…</span>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    )
  }
  return <SkeletonCard lines={4} />
}

function StateBlock({ loading, error, empty, emptyMessage, onRetry, skeleton = "card", children }) {
  if (loading) return <LoadingShape skeleton={skeleton} />

  if (error) {
    return (
      <Callout
        tone="danger"
        role="alert"
        title="Something went wrong"
        action={
          onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )
        }
      >
        {error.message}
      </Callout>
    )
  }

  if (empty) return <EmptyState icon={Inbox} title={emptyMessage} titleAs="p" />

  return (
    <m.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </m.div>
  )
}

export default StateBlock
