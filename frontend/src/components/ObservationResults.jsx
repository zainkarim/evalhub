import { useCallback } from "react"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import ScaleMeter from "./ScaleMeter"
import StateBlock from "./StateBlock"

// The completed observation form, read-only (#33, requirements §4.4: visible
// to observer and observee once both have signed; the committee can always
// view it). Nobody can change it here.
function ObservationResults({ observationId }) {
  const call = useCallback(() => api.getResponses(observationId), [observationId])
  const { data, error, loading, reload } = useApi(call)
  const rows = data?.data ?? []

  return (
    <StateBlock loading={loading} error={error} onRetry={reload}>
      {data &&
        (rows.length === 0 ? (
          <p className="text-sm text-muted">The observer hasn&apos;t filled in the form yet.</p>
        ) : (
          <>
            <ol className="divide-y divide-line rounded-md border border-line bg-white">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-sm"
                >
                  <span>{row.criterionName}</span>
                  <span className="flex items-center gap-3">
                    <ScaleMeter max={row.maxScore} value={row.score} />
                    <span className="w-12 text-right tabular-nums">
                      <span className="font-semibold">{row.score}</span>
                      <span className="text-muted"> / {row.maxScore}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            {data.notes && (
              <div className="mt-4 rounded-md border border-line bg-canvas px-4 py-3">
                <p className="text-xs font-medium text-muted">Observer&apos;s notes</p>
                <p className="mt-1 whitespace-pre-line text-sm">{data.notes}</p>
              </div>
            )}
          </>
        ))}
    </StateBlock>
  )
}

export default ObservationResults
