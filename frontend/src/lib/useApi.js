import { useCallback, useEffect, useState } from "react"

/**
 * Runs an API call and tracks loading/error state.
 * `call` must be wrapped in useCallback by the caller so it stays stable
 * between renders; a new `call` re-fetches.
 */
export function useApi(call) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [activeCall, setActiveCall] = useState(() => call)
  const [attempt, setAttempt] = useState(0)

  // The call changed (new id, new filters) -> reset before fetching again.
  if (call !== activeCall) {
    setActiveCall(() => call)
    setState({ data: null, error: null, loading: true })
  }

  useEffect(() => {
    let active = true
    activeCall()
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((error) => active && setState({ data: null, error, loading: false }))
    return () => {
      active = false
    }
  }, [activeCall, attempt])

  const reload = useCallback(() => {
    setState({ data: null, error: null, loading: true })
    setAttempt((value) => value + 1)
  }, [])

  return { ...state, reload }
}
