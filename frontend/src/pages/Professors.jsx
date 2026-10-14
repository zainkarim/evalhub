import { useCallback } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { api } from "../lib/api"
import { formatRank } from "../lib/format"
import { useApi } from "../lib/useApi"

function Professors() {
  const call = useCallback(async () => {
    const response = await api.listProfessors()
    return response.data ?? []
  }, [])

  const { data: professors, error, loading, reload } = useApi(call)

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Faculty Evaluation Roster
          </h1>

          <p className="mt-1 text-sm text-muted">
            View faculty members and their evaluation information.
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
        <StateBlock
          loading={loading}
          error={error}
          onRetry={reload}
          empty={professors?.length === 0}
          emptyMessage="No professors on the roster yet."
        >
          <div className="relative overflow-x-auto rounded border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {professors?.map((professor) => (
                  <tr
                    key={professor.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/professors/${professor.id}`}
                        className="font-medium text-utd-green hover:underline"
                      >
                        {professor.firstName} {professor.lastName}
                      </Link>

                      <span className="block text-muted">
                        {professor.email}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {formatRank(professor.rank)}
                    </td>

                    <td className="px-4 py-3">
                      {professor.isActive ? "Active" : "Inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </div>
    </div>
  )
}

export default Professors