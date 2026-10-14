import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import ProfessorsTable from "../components/ProfessorsTable"
import StateBlock from "../components/StateBlock"
import { api } from "../lib/api"
import { DUE_STATUS } from "../lib/dueStatus"
import { formatRank, formatTerm } from "../lib/format"
import { sortRows } from "../lib/professorSort"
import { useApi } from "../lib/useApi"

const RANKS = ["assistant_professor", "associate_professor", "full_professor"]
const NO_FILTERS = { q: "", due: "", signUp: "", rank: "", department: "" }
const fieldClass = "mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm"

function Tile({ label, value, note }) {
  return (
    <div className="rounded border border-line bg-white px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}

// Committee only (requirements §4.11): every active professor, signed up or not, with
// where they stand for the chosen semester.
function Professors() {
  const [termId, setTermId] = useState(null) // null = the server's current-or-next term
  const [filters, setFilters] = useState(NO_FILTERS)
  const [sort, setSort] = useState({ key: "due", direction: "asc" })

  const call = useCallback(async () => {
    const [report, terms] = await Promise.all([api.professorReport(termId), api.listTerms({})])
    // Spring and Fall only: Summer is not a cycle term.
    const cycleTerms = (terms.data ?? [])
      .filter((term) => term.season !== "summer")
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    return { report, terms: cycleTerms }
  }, [termId])
  const { data, error, loading, reload } = useApi(call)

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const matching = (data?.report.data ?? []).filter(
      (row) =>
        (!q || `${row.firstName} ${row.lastName} ${row.email}`.toLowerCase().includes(q)) &&
        (!filters.due || row.dueStatus === filters.due) &&
        (!filters.signUp || (filters.signUp === "signed_up") === Boolean(row.signUp)) &&
        (!filters.rank || row.rank === filters.rank) &&
        (!filters.department || row.department === filters.department),
    )
    return sortRows(matching, sort)
  }, [data, filters, sort])

  const departments = useMemo(
    () => [...new Set((data?.report.data ?? []).map((row) => row.department))].sort(),
    [data],
  )

  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
  const sortBy = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    )

  const counts = data?.report.counts
  const filtered = Object.values(filters).some(Boolean)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Professors</h1>
          <p className="mt-1 text-sm text-muted">
            Every active professor: who is due, who has signed up, and where their observation stands.
          </p>
        </div>

        <Link
          to="/professors/new"
          className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Add Professor
        </Link>
      </div>

      <div className="mt-6">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {data && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm">
                  <span className="font-medium">Semester</span>
                  <select
                    value={data.report.term.id}
                    onChange={(event) => setTermId(Number(event.target.value))}
                    className={`${fieldClass} min-w-40`}
                  >
                    {data.terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {formatTerm(term)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="pb-2 text-xs text-muted">
                  Due status is worked out from each professor&apos;s observations finished before
                  this semester starts.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Tile
                  label="Due"
                  value={counts.due}
                  note={counts.neverObserved ? `${counts.neverObserved} never observed` : undefined}
                />
                <Tile label="Overdue" value={counts.overdue} />
                <Tile label="Not signed up" value={counts.notSignedUp} />
                <Tile label="Signed up" value={counts.signedUp} />
                <Tile label="Completed" value={counts.completed} />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
                <label className="col-span-2 text-sm">
                  <span className="font-medium">Search</span>
                  <input
                    type="search"
                    value={filters.q}
                    onChange={setFilter("q")}
                    placeholder="Name or email"
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Due status</span>
                  <select value={filters.due} onChange={setFilter("due")} className={fieldClass}>
                    <option value="">All</option>
                    {Object.entries(DUE_STATUS).map(([key, entry]) => (
                      <option key={key} value={key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="font-medium">Sign-up</span>
                  <select value={filters.signUp} onChange={setFilter("signUp")} className={fieldClass}>
                    <option value="">All</option>
                    <option value="signed_up">Signed up</option>
                    <option value="not_signed_up">Not signed up</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="font-medium">Rank</span>
                  <select value={filters.rank} onChange={setFilter("rank")} className={fieldClass}>
                    <option value="">All</option>
                    {RANKS.map((rank) => (
                      <option key={rank} value={rank}>
                        {formatRank(rank)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="font-medium">Department</span>
                  <select value={filters.department} onChange={setFilter("department")} className={fieldClass}>
                    <option value="">All</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
                <p>
                  Showing {rows.length} of {data.report.data.length}
                </p>
                {filtered && (
                  <button
                    type="button"
                    onClick={() => setFilters(NO_FILTERS)}
                    className="rounded border border-line px-3 py-1.5 text-ink hover:border-ink"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="mt-3">
                {rows.length === 0 ? (
                  <p className="rounded border border-line bg-white px-5 py-8 text-sm text-muted">
                    {data.report.data.length === 0
                      ? "No active professors on the roster yet."
                      : "No professors match these filters."}
                  </p>
                ) : (
                  <ProfessorsTable rows={rows} sort={sort} onSort={sortBy} termId={data.report.term.id} />
                )}
              </div>
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default Professors
