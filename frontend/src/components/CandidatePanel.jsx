import { useState } from "react"
import { api } from "../lib/api"
import {
  formatRank,
  fullName,
  meetingDates,
  REQUEST_STATUS,
  timeLeft,
} from "../lib/format"
import StatusBadge from "./StatusBadge"

const th = "px-4 py-3 font-medium"
const td = "px-4 py-3"

// The observer candidate list.
//   owner     -> the professor being observed: can pick who to send requests to
//   committee -> everyone else on the committee: same list, read-only, so they
//                can see how the pool was matched and who has answered
function CandidatePanel({ assessment, owner, onChanged }) {
  const [selected, setSelected] = useState([])
  const [possibleDates, setPossibleDates] = useState([])
  const [dateView, setDateView] = useState("quick")
  const [calendarMonth, setCalendarMonth] = useState(() => {
  const firstDate = meetingDates(assessment.section)[0]
  return firstDate ? firstDate.slice(0, 7) : ""
})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const { candidateList: list, candidates, status } = assessment
  const availableDates = meetingDates(assessment.section)
  const hasActivePairing = ["pending_ac_approval", "approved", "completed"].includes(status)
  const canRequest = owner && status === "candidates_generated" && list?.listSize > 0
  const canGenerate = ["signed_up", "candidates_generated"].includes(status) && !hasActivePairing

  const run = async (action) => {
    setBusy(true)
    setError("")
    try {
      await action()
      setSelected([])
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isPending = (candidate) => candidate.request?.status === "pending"
  const selectable = candidates.filter((candidate) => !isPending(candidate))

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )

    const allSelected =
    selectable.length > 0 && selected.length === selectable.length

      const toggleDate = (date) => {
        setPossibleDates((current) => {
          if (current.includes(date)) {
            return current.filter((item) => item !== date)
          }

          if (current.length >= 8) {
            return current
          }

          return [...current, date].sort()
        })
      }

  const dateSelected = (date) => possibleDates.includes(date)

  const validDateCount = possibleDates.length
  const calendarDate = calendarMonth
  ? new Date(`${calendarMonth}-01T12:00:00`)
  : null

  const calendarYear = calendarDate?.getFullYear()
  const calendarMonthIndex = calendarDate?.getMonth()

  const daysInCalendarMonth = calendarDate
    ? new Date(calendarYear, calendarMonthIndex + 1, 0).getDate()
    : 0

  const firstDayOfMonth = calendarDate
    ? new Date(calendarYear, calendarMonthIndex, 1).getDay()
    : 0

  return (
    <section className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="text-sm font-semibold">Observer candidates</h2>

      {!list ? (
        <div className="mt-3 text-sm">
          <p className="text-muted">
            {owner
              ? "Find professors from your school who have taught this course level. Up to five are shown, picked at random from everyone eligible."
              : "No candidate list has been generated for this sign-up yet."}
          </p>
          {canGenerate && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api.generateCandidates(assessment.id))}
              className="mt-4 rounded bg-utd-green px-4 py-2 font-medium text-white hover:bg-utd-green-dark disabled:opacity-60"
            >
              {busy
                ? "Searching…"
                : owner
                  ? "Find observer candidates"
                  : "Generate candidate list"}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Matched on course level {list.targetLevel}000 in {list.targetSchool}, taught within
            the last 2 years, and free at class time. {list.poolSize} eligible ·{" "}
            {list.listSize} shown.
            {list.poolSize > 0 && list.poolSize < 5 &&
              " Fewer than five qualify, so everyone eligible is listed."}
          </p>

          {list.listSize === 0 ? (
            <div className="mt-4 rounded border border-utd-orange/40 bg-canvas px-4 py-3 text-sm">
              <p className="font-medium">No eligible observers found.</p>
              <p className="mt-1 text-muted">
                The committee has been notified on its dashboard and can step in as observer.
              </p>
              {canGenerate && status === "signed_up" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => api.generateCandidates(assessment.id))}
                  className="mt-3 rounded border border-line bg-white px-3 py-1.5 hover:border-ink disabled:opacity-60"
                >
                  {busy ? "Checking…" : "Check again"}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded border border-line">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs text-muted">
                  <tr>
                    {canRequest && (
                      <th className={`${th} w-10`}>
                        <input
                          type="checkbox"
                          aria-label="Select all available candidates"
                          checked={allSelected}
                          onChange={() =>
                            setSelected(allSelected ? [] : selectable.map((c) => c.id))
                          }
                        />
                      </th>
                    )}
                    <th className={th}>Professor</th>
                    <th className={th}>Rank</th>
                    <th className={th}>Request</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id} className="border-b border-line last:border-0">
                      {canRequest && (
                        <td className={td}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${fullName(candidate)}`}
                            disabled={isPending(candidate)}
                            checked={selected.includes(candidate.id)}
                            onChange={() => toggle(candidate.id)}
                          />
                        </td>
                      )}
                      <td className={td}>{fullName(candidate)}</td>
                      <td className={td}>{formatRank(candidate.rank)}</td>
                      <td className={td}>
                        {candidate.request ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={candidate.request.status} map={REQUEST_STATUS} />
                            {isPending(candidate) && (
                              <>
                                <span className="text-xs text-muted">
                                  {timeLeft(candidate.request.expiresAt)}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => run(() => api.cancelRequest(candidate.request.id))}
                                  className="text-xs text-utd-green hover:underline"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">Not requested</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canRequest && (
            <div className="mt-4">
              {selected.length > 0 && (
                <div className="mb-5 rounded-xl border border-line bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-utd-green">
                        Step 2
                      </p>

                      <h3 className="mt-1 text-base font-semibold">
                        Choose possible observation dates
                      </h3>

                      <p className="mt-1 text-sm text-muted">
                        Choose 4–8 upcoming class meetings. The observer will select
                        one of these dates.
                      </p>
                    </div>

                    <div className="rounded-full bg-canvas px-3 py-1.5 text-xs font-medium">
                      {validDateCount}/8 selected
                    </div>
                  </div>

                  <div className="mt-5 inline-flex rounded-lg border border-line bg-canvas p-1">
                    <button
                      type="button"
                      onClick={() => setDateView("quick")}
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        dateView === "quick"
                          ? "bg-white text-utd-green shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      Quick Pick
                    </button>

                    <button
                      type="button"
                      onClick={() => setDateView("calendar")}
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        dateView === "calendar"
                          ? "bg-white text-utd-green shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      Calendar
                    </button>
                  </div>

                  {dateView === "quick" && (
                    <div className="mt-5">
                      <p className="mb-3 text-xs font-medium text-muted">
                        Upcoming class meetings
                      </p>

                      {availableDates.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {availableDates.slice(0, 8).map((date) => {
                            const chosen = dateSelected(date)

                            return (
                              <button
                                key={date}
                                type="button"
                                onClick={() => toggleDate(date)}
                                className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                                  chosen
                                    ? "border-utd-green bg-utd-green/5 text-utd-green"
                                    : "border-line bg-white hover:border-utd-green"
                                }`}
                              >
                                <span className="block font-medium">
                                  {new Date(`${date}T12:00:00`).toLocaleDateString(
                                    undefined,
                                    {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}
                                </span>

                                <span className="mt-1 block text-xs text-muted">
                                  {chosen ? "✓ Selected" : "Select date"}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="rounded-lg bg-canvas p-4 text-sm text-muted">
                          No upcoming class meetings are available.
                        </p>
                      )}
                    </div>
                  )}

                  {dateView === "calendar" && calendarDate && (
  <div className="mt-5 max-w-md rounded-xl border border-line bg-white p-4">
    <div className="mb-4 flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          const previous = new Date(
            calendarYear,
            calendarMonthIndex - 1,
            1,
          )
          setCalendarMonth(
            `${previous.getFullYear()}-${String(
              previous.getMonth() + 1,
            ).padStart(2, "0")}`,
          )
        }}
        className="rounded-lg border border-line px-3 py-2 text-sm hover:border-utd-green"
        aria-label="Previous month"
      >
        ←
      </button>

      <h4 className="font-semibold">
        {calendarDate.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })}
      </h4>

      <button
        type="button"
        onClick={() => {
          const next = new Date(
            calendarYear,
            calendarMonthIndex + 1,
            1,
          )
          setCalendarMonth(
            `${next.getFullYear()}-${String(
              next.getMonth() + 1,
            ).padStart(2, "0")}`,
          )
        }}
        className="rounded-lg border border-line px-3 py-2 text-sm hover:border-utd-green"
        aria-label="Next month"
      >
        →
      </button>
    </div>

    <div className="grid grid-cols-7 gap-1 text-center">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
        (day) => (
          <div
            key={day}
            className="py-2 text-xs font-medium text-muted"
          >
            {day}
          </div>
        ),
      )}

      {Array.from({ length: firstDayOfMonth }).map((_, index) => (
        <div key={`empty-${index}`} />
      ))}

      {Array.from(
        { length: daysInCalendarMonth },
        (_, index) => index + 1,
      ).map((day) => {
        const isoDate = `${calendarYear}-${String(
          calendarMonthIndex + 1,
        ).padStart(2, "0")}-${String(day).padStart(2, "0")}`

        const isClassDate = availableDates.includes(isoDate)
        const chosen = dateSelected(isoDate)
        const maxReached = validDateCount >= 8 && !chosen

        return (
          <button
            key={isoDate}
            type="button"
            disabled={!isClassDate || maxReached}
            onClick={() => toggleDate(isoDate)}
            className={`h-10 w-full rounded-md text-sm transition ${
              chosen
                ? "bg-utd-green font-semibold text-white"
                : isClassDate
                  ? "border border-utd-green/30 bg-utd-green/5 font-medium text-utd-green hover:bg-utd-green/10"
                  : "cursor-default text-muted/40"
            } disabled:cursor-not-allowed`}
            title={
              isClassDate
                ? chosen
                  ? "Selected class date"
                  : "Available class date"
                : "Class does not meet this day"
            }
          >
            {day}
          </button>
        )
      })}
    </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-muted">
          <span>● Class meeting</span>
          <span className="font-medium text-utd-green">
            ● Selected
          </span>
          <span>Only class meeting dates can be selected.</span>
        </div>
      </div>
    )}

                  {possibleDates.length > 0 && (
                    <div className="mt-5 border-t border-line pt-4">
                      <p className="text-xs font-medium text-muted">
                        Selected dates
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {possibleDates.map((date) => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => toggleDate(date)}
                            className="rounded-full border border-utd-green/30 bg-utd-green/5 px-3 py-1.5 text-xs font-medium text-utd-green"
                            title="Remove date"
                          >
                            {new Date(`${date}T12:00:00`).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                            {" ×"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p
                    className={`mt-4 text-xs ${
                      validDateCount >= 4 ? "text-utd-green" : "text-muted"
                    }`}
                  >
                    {validDateCount >= 4
                      ? `✓ ${validDateCount} dates selected — ready to send`
                      : `Choose ${4 - validDateCount} more ${
                          4 - validDateCount === 1 ? "date" : "dates"
                        } to continue`}
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={
                  busy ||
                  selected.length === 0 ||
                  validDateCount < 4
                }
                onClick={() =>
                  run(() =>
                    api.sendRequests(
                      assessment.id,
                      selected,
                      possibleDates,
                    ),
                  )
                }
                className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
              >
                {busy
                  ? "Sending…"
                  : selected.length > 1
                    ? `Send ${selected.length} requests`
                    : "Send request"}
              </button>

              <p className="mt-2 text-xs text-muted">
                You can ask one, several, or all of them — only people on this list.
                Each request expires after 48 hours, and when one person accepts the
                rest are cancelled.
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}

export default CandidatePanel
