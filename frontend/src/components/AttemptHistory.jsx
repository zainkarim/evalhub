import { ATTEMPT_EVENT, formatDate, formatDateTime, fullName } from "../lib/format"

const ROLE = { ac_member: "Assessment Committee", admin: "Administrator" }

// The record of what was tried: who did what, when, and why. Attempts that don't
// happen are never cancelled or deleted, so every entry stays here.
function AttemptHistory({ attempts = [], title = "Attempt history" }) {
  const groups = new Map()
  for (const entry of attempts) {
    groups.set(entry.attemptNo, [...(groups.get(entry.attemptNo) ?? []), entry])
  }

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        Every request, reply and postponement stays on the record. Nothing here is removed.
      </p>

      {attempts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing has happened on this sign-up yet.</p>
      ) : (
        [...groups.entries()].map(([attemptNo, entries]) => (
          <div key={attemptNo} className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Attempt {attemptNo}
            </h3>
            <ul className="mt-2 divide-y divide-line text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="py-2.5">
                  <p>
                    <span className="font-medium">{ATTEMPT_EVENT[entry.type] ?? entry.type}</span>
                    {entry.observer && <span className="text-muted"> · {fullName(entry.observer)}</span>}
                    {entry.date && <span className="text-muted"> · {formatDate(entry.date)}</span>}
                    {entry.count > 0 && (
                      <span className="text-muted"> · {entry.count} dates offered</span>
                    )}
                  </p>
                  {entry.reason && <p className="mt-0.5">Why: {entry.reason}</p>}
                  <p className="mt-0.5 text-xs text-muted">
                    {entry.by.name}
                    {ROLE[entry.by.role] ? ` (${ROLE[entry.by.role]})` : ""} ·{" "}
                    {formatDateTime(entry.at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

export default AttemptHistory
