// Loading, error and empty states shared by every page, so they all look and
// behave the same.
function StateBlock({ loading, error, empty, emptyMessage, onRetry, children }) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="space-y-3 rounded-lg border border-line bg-white p-5 shadow-xs"
      >
        {["w-1/3", "w-2/3", "w-1/2"].map((width) => (
          <div key={width} className={`h-3 ${width} animate-pulse rounded-full bg-line/80`} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-line border-l-4 border-l-utd-orange bg-white px-5 py-4 shadow-xs">
        <p className="text-sm font-medium text-ink">Something went wrong</p>
        <p className="mt-0.5 text-sm text-muted">{error.message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium hover:border-ink"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (empty) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-white/60 px-5 py-10 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    )
  }

  return children
}

export default StateBlock
