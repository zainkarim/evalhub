import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { hasTeacherProfile } from "../lib/roles"
import { useApi } from "../lib/useApi"

// In-app messages for the signed-in professor. Email delivery is not implemented.
// A message never gates anything: for example the observer list is usable as soon
// as it exists, whether or not the "list is ready" message has been sent.
function Inbox() {
  const [error, setError] = useState("")
  const call = useCallback(() => api.inbox(), [])
  const { data, error: loadError, loading, reload } = useApi(call)
  const items = data?.data ?? []

  const run = async (action) => {
    setError("")
    try {
      await action()
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <StateBlock
      loading={loading}
      error={loadError}
      onRetry={reload}
      empty={items.length === 0}
      emptyMessage="No notifications yet."
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{data?.unread ?? 0} unread</p>
        <button
          type="button"
          disabled={!data?.unread}
          onClick={() => run(() => api.markAllNotificationsRead())}
          className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink disabled:opacity-50"
        >
          Mark all read
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line rounded border border-line bg-surface">
        {items.map((item) => (
          <li key={item.id} className="px-5 py-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {!item.readAt && (
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full bg-utd-orange align-middle"
                      aria-label="Unread"
                    />
                  )}
                  {item.subject}
                </p>
                <p className="mt-1 text-muted">{item.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatDateTime(item.createdAt)} · from {item.sentBy.name}
                </p>
                {item.link && (
                  <Link
                    to={item.link}
                    onClick={() => !item.readAt && api.markNotificationRead(item.id)}
                    className="mt-2 inline-block font-medium text-utd-green hover:underline"
                  >
                    Open
                  </Link>
                )}
              </div>
              {!item.readAt && (
                <button
                  type="button"
                  onClick={() => run(() => api.markNotificationRead(item.id))}
                  className="rounded border border-line px-3 py-1.5 text-xs hover:border-ink"
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 rounded border border-utd-orange/40 bg-surface px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </StateBlock>
  )
}

function Notifications() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-muted">
        Messages about the observation cycle. They appear here only; email delivery is not
        implemented.
      </p>
      <div className="mt-6">
        {hasTeacherProfile(user) ? (
          <Inbox />
        ) : (
          <p className="rounded border border-line bg-surface px-5 py-8 text-sm text-muted">
            This account has no professor profile, so it has no inbox.
          </p>
        )}
      </div>
    </div>
  )
}

export default Notifications
