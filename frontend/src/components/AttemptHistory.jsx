import { ATTEMPT_EVENT, formatDate, formatDateTime, fullName } from "../lib/format"
import { Card } from "./ui"

const ROLE = { ac_member: "Assessment Committee", admin: "Administrator" }

// The record of what was tried: who did what, when, and why. Attempts that don't
// happen are never cancelled or deleted, so every entry stays here.
// `headingAs` is the heading level of the title (h2 on its own page, h3 when it sits
// inside another section); the attempt headings go one level below it.
function AttemptHistory({ attempts = [], title = "Attempt history", headingAs: Heading = "h2" }) {
  const GroupHeading = Heading === "h2" ? "h3" : "h4"
  const groups = new Map()
  for (const entry of attempts) {
    groups.set(entry.attemptNo, [...(groups.get(entry.attemptNo) ?? []), entry])
  }

  return (
    <Card as="section" className="mt-6">
      <Heading className="text-base font-semibold">{title}</Heading>
      <p className="mt-1 text-sm text-muted">
        Every request, reply and postponement stays on the record. Nothing here is removed.
      </p>

      {attempts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing has happened on this sign-up yet.</p>
      ) : (
        [...groups.entries()].map(([attemptNo, entries]) => (
          <div key={attemptNo} className="mt-5">
            <GroupHeading className="text-xs font-semibold text-muted">Attempt {attemptNo}</GroupHeading>
            <ul className="mt-3 ml-1.5 space-y-4 border-l border-line text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="relative pl-5">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary ring-1 ring-line"
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
    </Card>
  )
}

export default AttemptHistory
