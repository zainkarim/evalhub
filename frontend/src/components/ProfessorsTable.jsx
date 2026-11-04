import { Link } from "react-router-dom"
import StatusBadge from "./StatusBadge"
import { Table, TableCard, Td, Th } from "./ui"
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
        <div className="min-w-[11rem]">
          <Link to={`/professors/${row.id}?termId=${termId}`} className="font-medium text-primary-ink hover:underline">
            {row.firstName} {row.lastName}
          </Link>
          <span className="block break-words text-muted">{row.email}</span>
        </div>
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
          <span className="font-medium text-success">Signed up</span>
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
          <Link to={`/professors/${row.id}/edit`} className="mt-1 block text-xs font-medium text-primary-ink hover:underline">
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
    <TableCard maxHeight>
      <Table minWidth="66rem">
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort.key === column.key
              return (
                <Th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="inline-flex items-center gap-1 rounded-sm hover:text-ink"
                  >
                    {column.label}
                    <span aria-hidden="true" className={active ? "text-ink" : "text-line"}>
                      {active && sort.direction === "desc" ? "▼" : "▲"}
                    </span>
                  </button>
                </Th>
              )
            })}
            {/* Later: a "Send reminder" action column goes here (not built yet). */}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line align-top last:border-0">
              {COLUMNS.map((column) => (
                <Td key={column.key}>
                  <Cell column={column} row={row} termId={termId} />
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}

export default ProfessorsTable
