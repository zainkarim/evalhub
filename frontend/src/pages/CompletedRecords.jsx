import { ClipboardList } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { Callout, EmptyState, Input, PageHeader, Select, Table, TableCard, Td, Th } from "../components/ui"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import { courseLabel, formatDate, formatTerm, fullName } from "../lib/format"
import { isViewOnly } from "../lib/roles"
import { useApi } from "../lib/useApi"

const termKey = (term) => (term ? `${term.year}-${term.season}` : "")

// Every completed observation, read-only (#126). This is the only page the
// Department Head and Annual Review Committee see; the committee can open it
// too. The backend returns completed records only to the view-only roles.
function CompletedRecords() {
  const { user } = useAuth()
  const viewOnly = isViewOnly(user)
  const call = useCallback(() => api.listObservations({ status: "completed", pageSize: 100 }), [])
  const { data, error, loading, reload } = useApi(call)
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")

  const rows = useMemo(() => data?.data ?? [], [data])

  const terms = useMemo(() => {
    const seen = new Map()
    for (const row of rows) {
      const t = row.section?.term
      if (t && !seen.has(termKey(t))) seen.set(termKey(t), t)
    }
    return [...seen.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [rows])

  const visible = rows.filter((row) => {
    if (term && termKey(row.section?.term) !== term) return false
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return [
      fullName(row.observee),
      fullName(row.observer),
      row.section?.course ? courseLabel(row.section.course) : "",
      row.section?.course?.title ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Completed observations"
        subtitle="Every peer observation that both the observer and the observee have signed off. Records are final and view-only."
      />

      {viewOnly && (
        <Callout tone="info" title="View-only access">
          Your account can read completed observation records. Sign-ups, scheduling and
          observations still in progress are handled by the faculty and the Assessment
          Committee.
        </Callout>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by professor or course"
          aria-label="Search completed observations"
          className="max-w-sm"
        />
        <Select
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label="Filter by term"
          className="w-auto"
        >
          <option value="">All terms</option>
          {terms.map(([key, t]) => (
            <option key={key} value={key}>
              {formatTerm(t)}
            </option>
          ))}
        </Select>
      </div>

      <StateBlock loading={loading} error={error} onRetry={reload}>
        {data &&
          (visible.length === 0 ? (
            <EmptyState
              compact
              icon={ClipboardList}
              titleAs="p"
              title={rows.length === 0 ? "No completed observations yet" : "No records match your search"}
            />
          ) : (
            <TableCard>
              <Table minWidth="44rem">
                <thead>
                  <tr>
                    <Th>Professor observed</Th>
                    <Th>Course</Th>
                    <Th>Observer</Th>
                    <Th>Date</Th>
                    <Th>
                      <span className="sr-only">Open</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0">
                      <Td>
                        <span className="font-medium">{fullName(row.observee)}</span>
                      </Td>
                      <Td>
                        {row.section?.course ? courseLabel(row.section.course) : "—"}
                        {row.section?.term && (
                          <span className="block text-muted">
                            {formatTerm(row.section.term)} · Section {row.section.sectionNumber}
                          </span>
                        )}
                      </Td>
                      <Td>{fullName(row.observer)}</Td>
                      <Td>{formatDate(row.scheduledDate)}</Td>
                      <Td>
                        <Link
                          to={`/records/${row.id}`}
                          className="whitespace-nowrap font-medium text-primary-ink hover:underline"
                        >
                          View record
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          ))}
      </StateBlock>
    </div>
  )
}

export default CompletedRecords
