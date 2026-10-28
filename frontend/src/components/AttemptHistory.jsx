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
    <section className="mt-6 rounded-lg border border-line bg-white p-6 shadow-xs">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        Every request, reply and postponement stays on the record. Nothing here is removed.
      </p>

      {attempts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing has happened on this sign-up yet.</p>
      ) : (
        [...groups.entries()].map(([attemptNo, entries]) => (
          <div key={attemptNo} className="mt-5">
            <h3 className="text-xs font-semibold text-muted">Attempt {attemptNo}</h3>
            <ul className="mt-3 ml-1.5 space-y-4 border-l border-line text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="relative pl-5">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-white bg-utd-green ring-1 ring-line"
                  />
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
