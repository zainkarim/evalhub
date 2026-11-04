import { Link } from "react-router-dom"
import StatusBadge from "./StatusBadge"
import {
  OBSERVATION_STATUS,
  courseLabel,
  formatDate,
  formatTerm,
  fullName,
} from "../lib/format"

export default function ObservationRows({ rows, mode, view }) {
  const direction = mode ?? (view === "observer" ? "given" : "received")

  if (rows.length === 0) {
    return <p className="text-sm text-muted">No observations yet.</p>
  }

  return (
    <div className="relative overflow-x-auto rounded-lg border border-line bg-white shadow-xs">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 font-medium">
              {direction === "given" ? "Observing" : "Observer"}
            </th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((observation) => (
            <tr
              key={observation.id}
              className="border-b border-line last:border-0"
            >
              <td className="px-4 py-3">
                {observation.section?.course
                  ? courseLabel(observation.section.course)
                  : "—"}
                {observation.section?.term && (
                  <span className="block text-muted">
                    {formatTerm(observation.section.term)} · Section{" "}
                    {observation.section.sectionNumber}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {fullName(
                  direction === "given"
                    ? observation.observee
                    : observation.observer
                )}
              </td>
              <td className="px-4 py-3">
                {formatDate(observation.scheduledDate)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={observation.status}
                  map={OBSERVATION_STATUS}
                />
                {observation.status === "approved" && (
                  <span className="mt-1 block text-xs text-muted">
                    {(direction === "given"
                      ? observation.observerSignedOffAt
                      : observation.observeeSignedOffAt)
                      ? "You signed off"
                      : "Your sign-off is pending"}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/records/${observation.id}`}
                  className="whitespace-nowrap font-medium text-utd-green hover:underline"
                >
                  {observation.status === "approved" ? "Sign off" : "View"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}