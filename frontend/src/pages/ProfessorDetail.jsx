import { useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { formatRank } from "./Professors"

function ProfessorDetail() {
  const { id } = useParams()
  const call = useCallback(() => api.getProfessor(id), [id])
  const { data: professor, error, loading, reload } = useApi(call)

  return (
    <div>
      <Link
        to="/professors"
        className="text-sm text-muted hover:text-ink"
      >
        Back to professors
      </Link>

      <div className="mt-4">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {professor && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {professor.firstName} {professor.lastName}
                  </h1>

                  <p className="mt-1 text-muted">{formatRank(professor.rank)}</p>
                </div>

                <Link
                  to={`/professors/${professor.id}/edit`}
                  className="rounded border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Edit Professor
                </Link>
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 rounded border border-line bg-white p-6 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted">Email</dt>
                  <dd className="mt-0.5 text-sm">{professor.email}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted">School</dt>
                  <dd className="mt-0.5 text-sm">{professor.school}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted">Last evaluated</dt>
                  <dd className="mt-0.5 text-sm">
                    {professor.lastEvaluated ?? "Never"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted">Status</dt>
                  <dd className="mt-0.5 text-sm">
                    {professor.isActive ? "Active" : "Inactive"}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default ProfessorDetail