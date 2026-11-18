import { FlaskConical } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { USE_MOCKS } from "../../lib/api"
import { resetMockData } from "../../lib/mockServer"
import { Button } from "../ui"
import { useToast } from "../ui/toast-context"
import { DEV_GROUPS, DEV_PASSWORD } from "./devAccounts"

// Developer quick login: a small button in the bottom-right corner that opens a
// popover of demo accounts grouped by role. One click signs in through the same
// `onSignIn(email, password)` the sign-in form uses. Shown only in development
// or demo (mock) mode; Login.jsx imports this lazily behind that guard.
// It is a disclosure (button + panel) like UserMenu: Esc closes and returns
// focus, a click or focus outside closes, and the panel opens upward.
function DevQuickLogin({ onSignIn, onReset }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const wrapper = useRef(null)
  const trigger = useRef(null)
  const panelId = useId()
  const toast = useToast()

  useEffect(() => {
    if (!open) return undefined
    const outside = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener("mousedown", outside)
    document.addEventListener("focusin", outside)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", outside)
      document.removeEventListener("focusin", outside)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const signInAs = async (email) => {
    setError(null)
    setBusy(email)
    try {
      await onSignIn(email, DEV_PASSWORD)
    } catch (err) {
      setError(err.message)
      setBusy(null)
    }
  }

  const reset = () => {
    resetMockData()
    setError(null)
    onReset?.()
    toast.success("Demo data reset to its starting state.")
  }

  return (
    <aside ref={wrapper} aria-label="Developer tools" className="fixed bottom-4 right-4 z-40">
      <Button
        ref={trigger}
        variant="secondary"
        size="sm"
        icon={FlaskConical}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Developer quick login"
        title="Developer quick login"
        className="shadow-sm"
      >
        <span className="max-sm:sr-only">Dev</span>
      </Button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Developer quick login"
          className="absolute bottom-full right-0 mb-2 max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border border-line bg-surface p-4 text-ink shadow-lg"
        >
          <h2 className="text-sm font-semibold">Developer quick login</h2>
          <p className="mt-0.5 text-xs text-muted">Visible only in development / demo mode.</p>

          {DEV_GROUPS.map((group) => {
            const accounts = group.accounts.filter((account) => !account.mockOnly || USE_MOCKS)
            if (accounts.length === 0) return null
            return (
              <div key={group.title} className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</h3>
                <ul className="mt-1.5 space-y-1">
                  {accounts.map((account) => (
                    <li key={account.email}>
                      <button
                        type="button"
                        onClick={() => signInAs(account.email)}
                        disabled={busy !== null}
                        aria-busy={busy === account.email}
                        className="block w-full rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex items-center justify-between gap-2 font-medium">
                          {account.label}
                          {busy === account.email && <span className="text-xs font-normal text-muted">Signing in…</span>}
                        </span>
                        <span className="block break-all text-xs text-muted">{account.email}</span>
                        <span className="block text-xs text-muted">{account.note}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          {error && (
            <p role="alert" className="mt-3 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {USE_MOCKS && (
            <div className="mt-4 border-t border-line pt-3">
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset demo data
              </Button>
              <p className="mt-1 text-xs text-muted">Sample data lives in this browser only.</p>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export default DevQuickLogin
