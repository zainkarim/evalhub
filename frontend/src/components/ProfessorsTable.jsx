import { Link } from "react-router-dom"
import StatusBadge from "./StatusBadge"
import { describeDue, DUE_STATUS } from "../lib/dueStatus"
import { ACTIVE_STATUS, CURRENT_STATUS, currentStatusDetail, formatDate } from "../lib/format"

// Each column header; the sorting for each key is in lib/professorSort.js.
const COLUMNS = [
  { key: "name", label: "Professor" },
  { key: "department", label: "Department" },
  { key: "rank", label: "Rank" },
  { key: "due", label: "Due status" },
  { key: "nextDue", label: "Next due" },
  { key: "lastObserved", label: "Last observed" },
  { key: "current", label: "Current status" },
  { key: "signUp", label: "Sign-up" },
  { key: "active", label: "Status" },
]

function Cell({ column, row, termId }) {
  switch (column.key) {
    case "name":
      return (
        <>
          <Link to={`/professors/${row.id}?termId=${termId}`} className="font-medium text-utd-green hover:underline">
            {row.firstName} {row.lastName}
          </Link>
          <span className="block text-muted">{row.email}</span>
        </>
      )
    case "department":
      return row.department
    case "rank":
      return row.rankLabel
    case "due":
      return <StatusBadge status={row.dueStatus} map={DUE_STATUS} />
    case "nextDue":
      return describeDue({ status: row.dueStatus, dueWindow: row.dueWindow })
    case "lastObserved":
      return row.lastCompleted ? formatDate(row.lastCompleted.date) : <span className="text-muted">Never</span>
    case "current":
      return (
        <>
          <StatusBadge status={row.currentStatus} map={CURRENT_STATUS} />
          {currentStatusDetail(row) && <span className="mt-1 block text-xs text-muted">{currentStatusDetail(row)}</span>}
        </>
      )
    case "signUp":
      return row.signUp ? (
        <>
          <span className="font-medium text-utd-green-dark">Signed up</span>
          <span className="block text-xs text-muted">
            {row.signUp.course} · Section {row.signUp.section}
          </span>
        </>
      ) : (
        <span className="text-muted">Not signed up</span>
      )
    case "active":
      return (
        <>
          <StatusBadge status={row.isActive ? "active" : "inactive"} map={ACTIVE_STATUS} />
          <Link to={`/professors/${row.id}/edit`} className="mt-1 block text-xs text-utd-green hover:underline">
            Edit
            <span className="sr-only">
              {" "}
              {row.firstName} {row.lastName}
            </span>
          </Link>
        </>
      )
    default:
      return null
  }
}

// The roster with one sortable header per column. `sort` is { key, direction }.
function ProfessorsTable({ rows, sort, onSort, termId }) {
  return (
    <div className="relative overflow-x-auto rounded border border-line bg-surface">
      <table className="w-full min-w-[66rem] text-left text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            {COLUMNS.map((column) => {
              const active = sort.key === column.key
              return (
                <th
                  key={column.key}
                  scope="col"
                  className="px-4 py-3 font-medium"
                  aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    {column.label}
                    <span aria-hidden="true" className={active ? "text-ink" : "text-line"}>
                      {active && sort.direction === "desc" ? "▼" : "▲"}
                    </span>
                  </button>
                </th>
              )
            })}
            {/* Later: a "Send reminder" action column goes here (not built yet). */}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line align-top last:border-0">
              {COLUMNS.map((column) => (
                <td key={column.key} className="px-4 py-3">
                  <Cell column={column} row={row} termId={termId} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ProfessorsTable
