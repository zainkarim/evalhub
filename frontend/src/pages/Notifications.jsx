import { BellOff, UserX } from "lucide-react"
import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { Button, Callout, Card, CardBody, EmptyState, PageHeader, StaggerItem } from "../components/ui"
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
    <StateBlock loading={loading} error={loadError} onRetry={reload}>
      {data &&
        (items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            titleAs="h2"
            title="No notifications yet"
            text="Messages about the observation cycle will appear here."
          />
        ) : (
          <Card padded={false}>
            <CardBody className="flex items-center justify-between gap-3 border-b border-line">
              <p className="text-sm text-muted tabular-nums">{data.unread ?? 0} unread</p>
              <Button
                variant="secondary"
                size="sm"
                disabled={!data.unread}
                onClick={() => run(() => api.markAllNotificationsRead())}
              >
                Mark all read
              </Button>
            </CardBody>
            <ul className="divide-y divide-line">
              {items.map((item, index) => (
                <StaggerItem as="li" scope="notifications" index={index} key={item.id} className="px-6 py-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {!item.readAt && (
                          <span
                            className="mr-2 inline-block h-2 w-2 rounded-full bg-accent align-middle"
                            role="img"
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
                          className="mt-2 inline-block font-medium text-primary hover:underline"
                        >
                          Open
                        </Link>
                      )}
                    </div>
                    {!item.readAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => run(() => api.markNotificationRead(item.id))}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </ul>
          </Card>
        ))}
      {error && (
        <Callout tone="danger" role="alert" className="mt-3">
          {error}
        </Callout>
      )}
    </StateBlock>
  )
}

function Notifications() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Messages about the observation cycle. They appear here only; email delivery is not implemented."
      />
      {hasTeacherProfile(user) ? (
        <Inbox />
      ) : (
        <EmptyState
          icon={UserX}
          titleAs="h2"
          title="This account has no professor profile, so it has no inbox"
        />
      )}
    </div>
  )
}

export default Notifications
