import { ClipboardList } from "lucide-react"
import { Link } from "react-router-dom"
import StatusBadge from "./StatusBadge"
import { EmptyState, Table, TableCard, Td, Th } from "./ui"
import {
  OBSERVATION_STATUS,
  courseLabel,
  formatDate,
  formatTerm,
  fullName,
} from "../lib/format"

// `empty` is the sentence shown when the list has no rows.
export default function ObservationRows({ rows, mode, view, empty = "No observations yet" }) {
  const direction = mode ?? (view === "observer" ? "given" : "received")

  if (rows.length === 0) {
    return <EmptyState compact icon={ClipboardList} titleAs="p" title={empty} />
  }

  return (
    <TableCard>
      <Table minWidth="40rem">
        <thead>
          <tr>
            <Th>Course</Th>
            <Th>{direction === "given" ? "Observing" : "Observer"}</Th>
            <Th>Date</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Open</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((observation) => (
            <tr key={observation.id} className="border-b border-line last:border-0">
              <Td>
                {observation.section?.course ? courseLabel(observation.section.course) : "—"}
                {observation.section?.term && (
                  <span className="block text-muted">
                    {formatTerm(observation.section.term)} · Section {observation.section.sectionNumber}
                  </span>
                )}
              </Td>
              <Td>
                {fullName(direction === "given" ? observation.observee : observation.observer)}
              </Td>
              <Td>{formatDate(observation.scheduledDate)}</Td>
              <Td>
                <StatusBadge status={observation.status} map={OBSERVATION_STATUS} />
                {observation.status === "approved" && (
                  <span className="mt-1 block text-xs text-muted">
                    {(direction === "given"
                      ? observation.observerSignedOffAt
                      : observation.observeeSignedOffAt)
                      ? "You signed off"
                      : "Your sign-off is pending"}
                  </span>
                )}
              </Td>
              <Td>
                <Link
                  to={`/records/${observation.id}`}
                  className="whitespace-nowrap font-medium text-primary-ink hover:underline"
                >
                  {observation.status === "approved" ? "Sign off" : "View"}
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}
