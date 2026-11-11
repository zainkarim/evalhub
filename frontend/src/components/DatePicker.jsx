import { Check, X } from "lucide-react"
import { useState } from "react"
import { formatDate } from "../lib/format"
import DateCalendar from "./DateCalendar"
import { cx } from "./ui/cx"

const QUICK_COUNTS = [4, 6, 8]

const shortDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

// Two buttons side by side where exactly one is "on".
function Segmented({ label, children }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-line bg-surface">
      {children}
    </div>
  )
}

function Segment({ active, className, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "min-h-9 px-4 text-sm transition-[color,background-color] duration-150",
        active ? "bg-primary font-medium text-primary-fg" : "text-muted hover:bg-surface-2 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        className,
      )}
      {...rest}
    />
  )
}

// Step 2 of the request: choose 4-8 class dates, in a calendar or from a list, with
// a live count and the chosen dates as removable chips. Presentation only: the
// parent keeps the chosen dates (`dates`, in the order they were picked) and the
// rules (`classDates` are the allowed ones, `onToggle` enforces the maximum).
function DatePicker({
  heading,
  classDates,
  dates,
  onToggle,
  onQuickPick,
  onClear,
  minDates,
  maxDates,
  deadline,
  termEnd,
  today,
}) {
  const [view, setView] = useState("calendar")

  const count = dates.length
  const valid = count >= minDates && count <= maxDates && dates.every((date) => classDates.includes(date))
  const atMax = count >= maxDates
  const sorted = [...dates].sort()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {heading}
        <Segmented label="Date picker view">
          <Segment active={view === "calendar"} onClick={() => setView("calendar")}>
            Calendar
          </Segment>
          <Segment active={view === "quick"} onClick={() => setView("quick")}>
            Quick Pick
          </Segment>
        </Segmented>
      </div>

      <p className="mt-2 text-xs text-muted">
        {deadline ? (
          <>
            Observation deadline <span className="font-medium text-warning">{formatDate(deadline)}</span>. Later dates
            can&apos;t be offered.
          </>
        ) : (
          "No observation deadline is set for this semester yet, so dates run to the end of the term."
        )}
      </p>

      {classDates.length === 0 ? (
        <p className="mt-4 rounded-card border border-line bg-surface-2 px-4 py-5 text-muted">
          No class meetings are left before the observation deadline.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {view === "calendar" ? (
            <DateCalendar
              classDates={classDates}
              dates={dates}
              onToggle={onToggle}
              maxDates={maxDates}
              deadline={deadline}
              termEnd={termEnd}
              today={today}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-muted">Pick the next</span>
                <Segmented label="Quick pick">
                  {QUICK_COUNTS.map((quick) => (
                    <Segment
                      key={quick}
                      active={
                        count === quick && sorted.join() === classDates.slice(0, quick).join()
                      }
                      disabled={classDates.length < quick}
                      onClick={() => onQuickPick(quick)}
                    >
                      Next {quick} classes
                    </Segment>
                  ))}
                </Segmented>
              </div>
              <ul className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-card border border-line bg-surface-2 p-3 sm:grid-cols-3">
                {classDates.map((value) => {
                  const checked = dates.includes(value)
                  const blocked = !checked && atMax
                  return (
                    <li key={value}>
                      <label
                        title={blocked ? `Maximum ${maxDates} dates` : undefined}
                        className={cx(
                          "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
                          "transition-[color,background-color,border-color] duration-150",
                          checked ? "border-primary-ink bg-surface font-medium" : "border-line bg-surface hover:border-ink",
                          blocked && "cursor-not-allowed bg-surface-2 text-muted hover:border-line",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={blocked}
                          onChange={() => onToggle(value)}
                          className="h-4 w-4 shrink-0 accent-primary-ink"
                        />
                        <span className="min-w-0 flex-1">{shortDate(value)}</span>
                        {checked && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-ink" />}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <div>
            <p
              aria-live="polite"
              className={cx("text-sm font-medium", valid ? "text-success" : "text-muted")}
            >
              {count} of {minDates}–{maxDates} dates selected
              {count > 0 && count < minDates ? ` (pick ${minDates - count} more)` : ""}
              {atMax ? ". Maximum reached: remove a date to pick another" : ""}
            </p>
            {count > 0 && (
              <ul aria-label="Selected dates" className="mt-2 flex flex-wrap items-center gap-2">
                {sorted.map((date) => (
                  <li key={date}>
                    <button
                      type="button"
                      onClick={() => onToggle(date)}
                      aria-label={`Remove ${shortDate(date)}`}
                      title="Remove this date"
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary-ink bg-surface px-3 text-xs hover:bg-surface-2"
                    >
                      {shortDate(date)}
                      <X aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={onClear}
                    className="min-h-8 px-1 text-xs font-medium text-primary-ink hover:underline"
                  >
                    Clear all
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
