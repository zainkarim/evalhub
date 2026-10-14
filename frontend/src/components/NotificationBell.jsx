import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { api, CHANGED_EVENT } from "../lib/api"
import { notificationLink, timeAgo } from "../lib/notifications"

// The bell in the header: unread count, a list of the newest notifications,
// mark-as-read on open, and "Mark all as read". Notifications come from
// GET /notifications (proposed contract, see docs/api-expectations.md). If
// that call fails (the real backend has no route yet), the bell stays quiet
// instead of breaking the header.
function NotificationBell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [available, setAvailable] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapper = useRef(null)

  // Refresh on navigation and after any change in the app (every POST/PATCH,
  // including marking notifications read, fires CHANGED_EVENT).
  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const result = await api.notifications()
        if (active) {
          setItems(result?.data ?? [])
          setAvailable(true)
        }
      } catch {
        if (active) setAvailable(false)
      }
    }
    refresh()
    window.addEventListener(CHANGED_EVENT, refresh)
    return () => {
      active = false
      window.removeEventListener(CHANGED_EVENT, refresh)
    }
  }, [location.pathname])

  // Close on a click outside the panel or on Escape.
  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const unread = items.filter((item) => !item.readAt).length

  const openNotification = async (notification) => {
    setOpen(false)
    if (!notification.readAt) {
      try {
        await api.markNotificationRead(notification.id)
      } catch {
        // still take the person where they wanted to go
      }
    }
    navigate(notificationLink(notification))
  }

  const markAll = async () => {
    setBusy(true)
    try {
      await api.markAllNotificationsRead() // the list refreshes via CHANGED_EVENT
    } catch {
      // the list simply stays as it was
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        title={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        className="relative rounded-md p-1.5 text-white/85 hover:bg-white/10 hover:text-white"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-utd-orange px-1 text-center text-[10px] font-semibold leading-4 text-white ring-2 ring-utd-green-dark">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-white text-ink shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unread > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={markAll}
                className="text-xs font-medium text-utd-green hover:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          {!available ? (
            <p className="px-4 py-5 text-sm text-muted">Notifications aren't available right now.</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">No notifications yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {[
                ["New", items.filter((item) => !item.readAt)],
                ["Earlier", items.filter((item) => item.readAt)],
              ]
                .filter(([, group]) => group.length > 0)
                .map(([title, group]) => (
                  <section key={title} aria-label={title}>
                    <h4 className="bg-canvas px-4 py-1.5 text-xs font-medium text-muted">{title}</h4>
                    <ul className="divide-y divide-line">
                      {group.map((notification) => (
                        <li key={notification.id}>
                          <button
                            type="button"
                            onClick={() => openNotification(notification)}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-canvas"
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                notification.readAt ? "bg-transparent" : "bg-utd-orange"
                              }`}
                            />
                            <span className="min-w-0">
                              <span className={`block ${notification.readAt ? "text-muted" : ""}`}>
                                {notification.message}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted">
                                {timeAgo(notification.createdAt)}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
