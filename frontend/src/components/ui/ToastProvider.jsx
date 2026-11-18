import { AnimatePresence, m } from "motion/react"
import { CircleAlert, CircleCheck, Info, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cx } from "./cx"
import { ToastContext } from "./toast-context"

const MAX_VISIBLE = 3
const DEFAULT_DURATION = { success: 5000, info: 5000, error: 8000 }

const TONES = {
  success: { icon: CircleCheck, bar: "border-l-success", color: "text-success" },
  info: { icon: Info, bar: "border-l-info", color: "text-info" },
  error: { icon: CircleAlert, bar: "border-l-danger", color: "text-danger" },
}

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.duration)
  const startedAt = useRef(0)
  const tone = TONES[toast.tone]
  const Icon = tone.icon

  // Auto-dismiss, paused while the pointer or keyboard focus is on the toast.
  // Cleanup keeps what is left of the timer, so resuming doesn't start over.
  useEffect(() => {
    if (!toast.duration || paused) return undefined
    startedAt.current = Date.now()
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, toast.duration, toast.id, onDismiss])

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cx(
        "pointer-events-auto mt-2 flex items-start gap-3 rounded-card border border-l-4 border-line bg-surface p-4 shadow-lg",
        tone.bar,
      )}
    >
      <Icon aria-hidden="true" className={cx("mt-0.5 h-5 w-5 shrink-0", tone.color)} />
      <div className="min-w-0 flex-1 text-sm">
        {toast.title && <p className="font-medium text-ink">{toast.title}</p>}
        <p className={toast.title ? "mt-0.5 text-muted" : "text-ink"}>{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </m.div>
  )
}

// Wrap the app once. Both live regions are always in the page (empty at first),
// because screen readers only announce changes to a region that already exists:
// a polite one for success/info and an assertive one for errors. The stack sits
// above any StickyActionBar (it publishes its height as --sticky-bar-h), so a
// toast never covers a Save button.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((tone, message, options = {}) => {
    counter.current += 1
    const toast = {
      id: counter.current,
      tone,
      message,
      title: options.title,
      duration: options.duration ?? DEFAULT_DURATION[tone],
    }
    setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), toast])
    return toast.id
  }, [])

  const api = useMemo(
    () => ({
      success: (message, options) => push("success", message, options),
      info: (message, options) => push("info", message, options),
      error: (message, options) => push("error", message, options),
      dismiss,
    }),
    [push, dismiss],
  )

  const renderRegion = (tones) =>
    toasts
      .filter((toast) => tones.includes(toast.tone))
      .map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)

  return (
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(var(--sticky-bar-h,0px),env(safe-area-inset-bottom,0px))_+_1rem)] z-50 px-4 sm:inset-x-auto sm:right-0 sm:w-[26rem]">
        <div role="status" aria-live="polite" aria-atomic="false">
          <AnimatePresence initial={false}>{renderRegion(["success", "info"])}</AnimatePresence>
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="false">
          <AnimatePresence initial={false}>{renderRegion(["error"])}</AnimatePresence>
        </div>
      </div>
    </ToastContext>
  )
}
