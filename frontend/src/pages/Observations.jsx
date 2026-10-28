import { CalendarClock, ClipboardList, Handshake, Inbox } from "lucide-react"
import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import IncomingRequest from "../components/IncomingRequest"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StaggerItem,
  TabPanel,
  Table,
  TableCard,
  Tabs,
  Td,
  Th,
} from "../components/ui"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  ALERT,
  ASSESSMENT_STATUS,
  courseLabel,
  formatDate,
  formatTerm,
  fullName,
} from "../lib/format"
import { hasTeacherProfile, isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"
import { nextStep } from "../lib/workflow"
import ObservationRows from "../components/ObservationRows"
import { loadObservationActivity } from "../lib/observationActivity"

// A titled card for one list on the page.
function Section({ title, hint, index, children }) {
  return (
    <StaggerItem scope="observations" index={index}>
      <Card padded={false}>
        <CardHeader title={title} description={hint} />
        <CardBody className="pb-6">{children}</CardBody>
      </Card>
    </StaggerItem>
  )
}

// ------------------------------------------------------------- committee ----

function AllSignUps() {
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")
  const call = useCallback(() => api.listAssessments({ status }), [status])
  const { data, error, loading, reload } = useApi(call)

  const text = search.trim().toLowerCase()
  const rows = (data?.data ?? []).filter(
    (item) =>
      !text ||
      `${fullName(item.teacher)} ${courseLabel(item.section.course)} ${item.section.course.title}`
        .toLowerCase()
        .includes(text),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by professor or course"
          aria-label="Search sign-ups"
          className="max-w-sm"
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="w-auto"
        >
          <option value="">All statuses</option>
          {Object.entries(ASSESSMENT_STATUS).map(([value, entry]) => (
            <option key={value} value={value}>
              {entry.label}
            </option>
          ))}
        </Select>
      </div>

      <StateBlock
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton="table"
        empty={rows.length === 0}
        emptyMessage="No observation sign-ups match these filters."
      >
        <TableCard>
          <Table minWidth="52rem">
            <thead>
              <tr>
                <Th>Professor</Th>
                <Th>Course</Th>
                <Th>Status</Th>
                <Th>Observer</Th>
                <Th>Date</Th>
                <Th>
                  <span className="sr-only">Open</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <Td>
                    <Link to={`/professors/${item.teacherId}`} className="font-medium text-primary-ink hover:underline">
                      {fullName(item.teacher)}
                    </Link>
                  </Td>
                  <Td>
                    {courseLabel(item.section.course)}
                    <span className="block text-muted">
                      {formatTerm(item.section.term)} · Section {item.section.sectionNumber}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                    {item.alert && (
                      <span title={ALERT[item.alert].text} className="mt-1 block text-xs font-medium text-warning">
                        {ALERT[item.alert].label}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {item.pairing && item.pairing.status !== "postponed"
                      ? fullName(item.pairing.observer)
                      : item.offer
                        ? fullName(item.offer.observer)
                        : "—"}
                    {item.offer && !["approved", "completed"].includes(item.pairing?.status) && (
                      <span className="block text-xs text-muted">Waiting for reply</span>
                    )}
                    {item.pairing?.isAcStepin && (
                      <span className="block text-xs text-muted">Committee step-in</span>
                    )}
                  </Td>
                  <Td>{item.pairing?.status === "postponed" ? "—" : formatDate(item.pairing?.scheduledDate)}</Td>
                  <Td>
                    <Link
                      to={`/assessments/${item.id}`}
                      className="whitespace-nowrap font-medium text-primary-ink hover:underline"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      </StateBlock>
    </div>
  )
}

// --------------------------------------------------------------- professor --


function MyActivity({ user }) {
  const call = useCallback(
    () => loadObservationActivity(user.teacherId),
    [user.teacherId]
  )
  const { data, error, loading, reload } = useApi(call)

  return (
    <StateBlock loading={loading} error={error} onRetry={reload}>
      {data && (
        <div className="space-y-6">
          <Section index={0} title="My sign-ups" hint="Each section you've signed up for, and what happens next.">
            {data.signUps.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                titleAs="p"
                title="You haven't signed up for an observation yet"
              />
            ) : (
              <TableCard>
                <Table minWidth="36rem">
                  <thead>
                    <tr>
                      <Th>Course</Th>
                      <Th>Status</Th>
                      <Th>Next step</Th>
                      <Th>
                        <span className="sr-only">Open</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.signUps.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0">
                        <Td>
                          {courseLabel(item.section.course)}
                          <span className="block text-muted">
                            {formatTerm(item.section.term)} · Section {item.section.sectionNumber}
                          </span>
                        </Td>
                        <Td>
                          <StatusBadge status={item.status} map={ASSESSMENT_STATUS} />
                        </Td>
                        <Td>{nextStep(item)}</Td>
                        <Td>
                          <Link
                            to={`/assessments/${item.id}`}
                            className="whitespace-nowrap font-medium text-primary-ink hover:underline"
                          >
                            Open
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableCard>
            )}
          </Section>

          <Section
            index={1}
            title="Requests to observe a colleague"
            hint="Colleagues from your school who picked you as their observer. Each request offers several dates: confirm one, or decline. Requests expire after 48 hours."
          >
            {data.incoming.length === 0 ? (
              <EmptyState compact icon={Inbox} titleAs="p" title="No one has asked you to observe a class" />
            ) : (
              <ul className="space-y-3">
                {data.incoming.map((request) => (
                  <IncomingRequest key={request.id} request={request} onChanged={reload} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            index={2}
            title="Observations I'm giving"
            hint="Classes you have agreed to observe. Sign off after the class takes place."
          >
            {data.given.length === 0 ? (
              <EmptyState compact icon={Handshake} titleAs="p" title="You aren't observing anyone right now" />
            ) : (
              <ObservationRows rows={data.given} mode="given" />
            )}
          </Section>

          <Section
            index={3}
            title="Observations I'm receiving"
            hint="Colleagues observing your classes. You can see who and when."
          >
            {data.received.length === 0 ? (
              <EmptyState compact icon={CalendarClock} titleAs="p" title="No one is observing your classes yet" />
            ) : (
              <ObservationRows rows={data.received} mode="received" />
            )}
          </Section>
        </div>
      )}
    </StateBlock>
  )
}

// ------------------------------------------------------------------ page ----

const TABS = [
  { id: "all", label: "All sign-ups" },
  { id: "mine", label: "My observations" },
]

function Observations() {
  const { user } = useAuth()
  const committee = isAC(user)
  const mine = hasTeacherProfile(user)
  const [tab, setTab] = useState(committee ? "all" : "mine")
  const hasTabs = committee && mine

  return (
    <div className="space-y-6">
      <PageHeader
        title={committee ? "Observation Requests" : "My Observations"}
        subtitle={
          committee
            ? "Every faculty sign-up, its observer and its status. Start observer selection and see alerts on the Cycle page."
            : "Your sign-ups, requests from colleagues, and the observations you give and receive."
        }
        action={
          (mine || committee) && (
            <Button to="/observation-signup">{committee ? "Sign up a professor" : "Request Observation"}</Button>
          )
        }
      />

      {hasTabs ? (
        <>
          <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Observation views" idPrefix="obs" />
          <TabPanel id="all" value={tab} idPrefix="obs">
            <AllSignUps />
          </TabPanel>
          <TabPanel id="mine" value={tab} idPrefix="obs">
            <MyActivity user={user} />
          </TabPanel>
        </>
      ) : committee ? (
        <AllSignUps />
      ) : (
        <MyActivity user={user} />
      )}
    </div>
  )
}

export default Observations
