import { Component } from "react"
import { TriangleAlert } from "lucide-react"
import { Button, EmptyState } from "./ui"

// Catches a render error in one page (for example a response shape the page
// does not expect, or a page chunk that failed to download) and shows an error
// card instead of a blank screen. The header and navigation stay usable.
// It resets when `resetKey` changes (a new route), or with "Try again".
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.reset = this.reset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error("Page failed to render:", error, info?.componentStack)
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  reset() {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div role="alert" className={this.props.fullScreen ? "grid min-h-screen place-items-center px-4" : ""}>
        <EmptyState
          icon={TriangleAlert}
          titleAs="h1"
          title="Something went wrong"
          text="This page couldn't load. Try again, or go back to the home page. If it keeps happening, let the team know what you were doing."
          className="mx-auto w-full max-w-xl"
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={this.reset}>Try again</Button>
              <Button variant="secondary" to="/">
                Go to home
              </Button>
            </div>
          }
        />
        {import.meta.env.DEV && (
          <details className="mx-auto mt-4 max-w-xl text-left text-xs text-muted">
            <summary className="cursor-pointer">Error details (development only)</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-card border border-line bg-surface p-3">
              {String(error?.stack || error?.message || error)}
            </pre>
          </details>
        )}
      </div>
    )
  }
}

export default RouteErrorBoundary
