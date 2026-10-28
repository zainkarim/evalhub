import { Users } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import ProfessorsTable from "../components/ProfessorsTable"
import StateBlock from "../components/StateBlock"
import { Button, Card, CardBody, EmptyState, HelpText, Input, Label, PageHeader, Select } from "../components/ui"
import { api } from "../lib/api"
import { DUE_STATUS } from "../lib/dueStatus"
import { formatRank, formatTerm } from "../lib/format"
import { sortRows } from "../lib/professorSort"
import { useApi } from "../lib/useApi"

const RANKS = ["assistant_professor", "associate_professor", "full_professor"]
const NO_FILTERS = { q: "", due: "", signUp: "", rank: "", department: "" }

function Tile({ label, value, note }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-xs">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}

// The semester list never changes while the page is open, so it is loaded once.
// Spring and Fall only: Summer is not a cycle term.
const loadCycleTerms = async () => {
  const terms = await api.listTerms({})
  return (terms.data ?? [])
    .filter((term) => term.season !== "summer")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

// Committee only (requirements §4.11): the active professors, signed up or not, with
// where they stand for the chosen semester. "Show inactive" adds the inactive ones (with
// a link to edit them); the tiles only ever count active professors.
function Professors() {
  // The chosen semester lives in the URL (?termId=) so the detail page can link back to it.
  // No termId = the server's current-or-next term.
  const [searchParams, setSearchParams] = useSearchParams()
  const termId = searchParams.get("termId")
  const [filters, setFilters] = useState(NO_FILTERS)
  const [showInactive, setShowInactive] = useState(false)
  const [sort, setSort] = useState({ key: "due", direction: "asc" })

  const call = useCallback(() => api.professorReport(termId), [termId])
  const { data: report, error: reportError, loading: reportLoading, reload } = useApi(call)
  const { data: terms, error: termsError, loading: termsLoading, reload: reloadTerms } = useApi(loadCycleTerms)
  const data = report && terms ? { report, terms } : null
  const error = reportError ?? termsError
  const loading = reportLoading || termsLoading
  const retry = () => {
    if (reportError) reload()
    if (termsError) reloadTerms()
  }

  const roster = useMemo(
    () => (report?.data ?? []).filter((row) => showInactive || row.isActive),
    [report, showInactive],
  )

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const matching = roster.filter(
      (row) =>
        (!q || `${row.firstName} ${row.lastName} ${row.email}`.toLowerCase().includes(q)) &&
        (!filters.due || row.dueStatus === filters.due) &&
        (!filters.signUp || (filters.signUp === "signed_up") === Boolean(row.signUp)) &&
        (!filters.rank || row.rank === filters.rank) &&
        (!filters.department || row.department === filters.department),
    )
    return sortRows(matching, sort)
  }, [roster, filters, sort])

  const departments = useMemo(() => [...new Set(roster.map((row) => row.department))].sort(), [roster])

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
    <div className="space-y-6">
      <PageHeader
        title="Professors"
        subtitle="Active professors: who is due, who has signed up, and where their observation stands."
        action={<Button to="/professors/new">Add Professor</Button>}
      />

      <StateBlock loading={loading} error={error} onRetry={retry} skeleton="table">
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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

            <Card padded={false}>
              <CardBody className="py-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                  <div className="col-span-2">
                    <Label htmlFor="prof-term">Semester</Label>
                    <Select
                      id="prof-term"
                      value={data.report.term.id}
                      onChange={(event) => setSearchParams({ termId: event.target.value }, { replace: true })}
                      className="mt-1.5"
                    >
                      {data.terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {formatTerm(term)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="prof-search">Search</Label>
                    <Input
                      id="prof-search"
                      type="search"
                      value={filters.q}
                      onChange={setFilter("q")}
                      placeholder="Name or email"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prof-due">Due status</Label>
                    <Select id="prof-due" value={filters.due} onChange={setFilter("due")} className="mt-1.5">
                      <option value="">All</option>
                      {Object.entries(DUE_STATUS).map(([key, entry]) => (
                        <option key={key} value={key}>
                          {entry.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="prof-signup">Sign-up</Label>
                    <Select id="prof-signup" value={filters.signUp} onChange={setFilter("signUp")} className="mt-1.5">
                      <option value="">All</option>
                      <option value="signed_up">Signed up</option>
                      <option value="not_signed_up">Not signed up</option>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="prof-rank">Rank</Label>
                    <Select id="prof-rank" value={filters.rank} onChange={setFilter("rank")} className="mt-1.5">
                      <option value="">All</option>
                      {RANKS.map((rank) => (
                        <option key={rank} value={rank}>
                          {formatRank(rank)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="prof-dept">Department</Label>
                    <Select
                      id="prof-dept"
                      value={filters.department}
                      onChange={setFilter("department")}
                      className="mt-1.5"
                    >
                      <option value="">All</option>
                      {departments.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <HelpText>
                  Due status is worked out from each professor&apos;s observations finished before this
                  semester starts. The tiles count active professors only.
                </HelpText>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                  <p className="text-muted tabular-nums">
                    Showing {rows.length} of {roster.length}
                  </p>
                  <div className="ml-auto flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-ink">
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(event) => setShowInactive(event.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      Show inactive
                    </label>
                    {filtered && (
                      <Button variant="secondary" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title={roster.length === 0 ? "No active professors on the roster yet" : "No professors match these filters"}
                action={
                  roster.length === 0 ? (
                    <Button to="/professors/new" variant="secondary">
                      Add Professor
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ProfessorsTable rows={rows} sort={sort} onSort={sortBy} termId={data.report.term.id} />
            )}
          </>
        )}
      </StateBlock>
    </div>
  )
}

export default Professors
