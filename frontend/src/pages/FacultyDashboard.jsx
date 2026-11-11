import { Inbox } from "lucide-react"
import { useCallback, useState } from "react"
import ObservationRows from "../components/ObservationRows"
import StateBlock from "../components/StateBlock"
import { Badge, Button, Callout, Card, CardBody, CardHeader, EmptyState, PageHeader, StaggerItem, TabPanel, Tabs } from "../components/ui"
import { useAuth } from "../context/auth-context"
import { courseLabel, fullName, toDateOnly } from "../lib/format"
import { loadObservationActivity } from "../lib/observationActivity"
import { hasTeacherProfile } from "../lib/roles"
import { useApi } from "../lib/useApi"

const VIEWS = [
  { id: "observee", label: "Observee" },
  { id: "observer", label: "Observer" },
]

// A titled card for one list on the page.
function Section({ title, index, children }) {
  return (
    <StaggerItem scope="dashboard" index={index}>
      <Card padded={false}>
        <CardHeader title={title} />
        <CardBody className="pb-6">{children}</CardBody>
      </Card>
    </StaggerItem>
  )
}

const HEADER = (
  <PageHeader
    title="Faculty Observation Dashboard"
    subtitle="What is coming up, what needs your sign-off, and what is waiting on an answer, as observee or observer."
  />
)

export default function FacultyDashboard() {
  const [view, setView] = useState("observee")
  const { user } = useAuth()
  const hasProfile = hasTeacherProfile(user)

  const loadDashboard = useCallback(
    () =>
      hasProfile
        ? loadObservationActivity(user.teacherId)
        : Promise.resolve({
          signUps: [],
          incoming: [],
          given: [],
          received: [],
        }),
    [hasProfile, user.teacherId]
  )

  const { data, error, loading, reload } = useApi(loadDashboard)

  const observations =
    view === "observer"
      ? (data?.given ?? [])
      : (data?.received ?? [])

  const pendingRequests =
    view === "observer"
      ? (data?.incoming ?? []).filter((item) => item.status === "pending")
      : (data?.signUps ?? []).filter(
        (item) => item.offer?.status === "pending"
      )


  const mine = observations

  const today = toDateOnly(new Date().toLocaleDateString("en-CA"))

  const upcoming = mine
    .filter(
      (item) =>
        item.status === "approved" &&
        toDateOnly(item.scheduledDate) >= today
    )
    .sort((a, b) =>
      toDateOnly(a.scheduledDate).localeCompare(toDateOnly(b.scheduledDate))
    )

  const completed = mine.filter((item) => item.status === "completed")

  const postponed = mine.filter(
    (item) => item.status === "postponed"
  )

  const needsSignOff = mine.filter(
    (item) =>
      item.status === "approved" &&
      toDateOnly(item.scheduledDate) < today &&
      (view === "observer"
        ? !item.observerSignedOffAt
        : !item.observeeSignedOffAt)
  )

  if (loading || error) {
    return (
      <div className="space-y-6">
        {HEADER}
        <StateBlock loading={loading} error={error} onRetry={reload} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {HEADER}
      {!hasProfile && (
        <Callout tone="warning" role="alert">
          A teacher profile is required to view faculty observations.
        </Callout>
      )}

      <div>
        <Tabs tabs={VIEWS} value={view} onChange={setView} ariaLabel="Dashboard view" idPrefix="dash" />
        <TabPanel id={view} value={view} idPrefix="dash" className="mt-6 space-y-6">
          <Section index={0} title="Upcoming Confirmed Observations">
            <ObservationRows rows={upcoming} view={view} empty="No confirmed observations coming up" />
          </Section>

          <Section index={1} title="Needs Sign-off">
            <ObservationRows rows={needsSignOff} view={view} empty="Nothing is waiting for your sign-off" />
          </Section>

          <Section index={2} title="Postponed Observations">
            <ObservationRows rows={postponed} view={view} empty="No postponed observations" />
          </Section>

          <Section index={3} title="Pending Requests">
            {pendingRequests.length === 0 ? (
              <EmptyState compact icon={Inbox} titleAs="p" title="No pending requests" />
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
                {pendingRequests.map((request) => {
                  const offer = view === "observer" ? request : request.offer

                  return (
                    <li
                      key={offer.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {request.section?.course
                            ? courseLabel(request.section.course)
                            : "Observation request"}
                        </p>
                        <p className="text-sm text-muted">
                          {view === "observer"
                            ? `From: ${fullName(request.observee)}`
                            : `To: ${fullName(offer.observer)}`}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          <span className="sr-only">Status: </span>
                          <Badge tone="warning" size="sm" dot>
                            Pending
                          </Badge>
                        </p>
                      </div>

                      <Button
                        to={`/assessments/${view === "observer" ? request.assessmentId : request.id}`}
                        variant="secondary"
                        size="sm"
                      >
                        View
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section index={4} title="Completed Observations">
            <ObservationRows rows={completed} view={view} empty="No completed observations yet" />
          </Section>
        </TabPanel>
      </div>
    </div>
  )
}
