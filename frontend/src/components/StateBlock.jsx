function StateBlock({ loading, error, empty, emptyMessage, onRetry, children }) {
  if (loading) {
    return (
      <p className="rounded border border-line bg-white px-5 py-8 text-sm text-muted">
        Loading…
      </p>
    )
  }

  if (error) {
    return (
      <div className="rounded border border-utd-orange/40 bg-white px-5 py-6">
        <p className="text-sm text-ink">{error.message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded border border-line px-3 py-1.5 text-sm hover:border-ink"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (empty) {
    return (
      <p className="rounded border border-line bg-white px-5 py-8 text-sm text-muted">
        {emptyMessage}
      </p>
    )
  }

  return children
}

export default StateBlock
