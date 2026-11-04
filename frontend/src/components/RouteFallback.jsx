import { LoaderCircle } from "lucide-react"
import { Skeleton, SkeletonCard } from "./ui"

// Shown while a page's code is downloading (every page is its own chunk).
// Inside the app shell it is a skeleton shaped like a page: a title, a line of
// text and a card. On the public pages (no shell yet) it is a centred spinner.
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-3 h-3 w-80 max-w-full" />
      </div>
      <SkeletonCard lines={4} />
    </div>
  )
}

export function ScreenFallback() {
  return (
    <div role="status" className="grid min-h-screen place-items-center">
      <LoaderCircle aria-label="Loading" className="h-6 w-6 animate-spin text-muted" />
    </div>
  )
}
