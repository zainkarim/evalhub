import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { m, useReducedMotion } from "motion/react"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "./ui"
import { cx } from "./ui/cx"

const WEEKDAYS = [
  ["Sun", "Sunday"],
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
]

const pad = (value) => String(value).padStart(2, "0")
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const parse = (iso) => new Date(`${iso}T12:00:00`)
const monthOf = (iso) => iso.slice(0, 7)
const longDate = (iso) =>
  parse(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })

// A month grid for choosing class dates. Presentation only: the parent owns which
// dates are chosen (`dates`, `onToggle`) and which are allowed (`classDates`).
//
// Keyboard (one day is in the Tab order, the rest are reached with arrows):
// arrows move a day or a week, Home/End the start or end of the week, PageUp and
// PageDown the month, Enter or Space picks or removes the day. Days that can't be
// picked stay focusable (aria-disabled) so arrows never skip over them, and the
// month buttons stop at the first and last month that has a class day.
function DateCalendar({ classDates, dates, onToggle, maxDates, deadline, termEnd, today }) {
  const reduceMotion = useReducedMotion()
  const headingId = useId()
  const gridRef = useRef(null)
  const moveFocus = useRef(false)
  const [cursor, setCursor] = useState(() => classDates[0] ?? today)
  const [direction, setDirection] = useState(1)

  const month = monthOf(cursor)
  const firstMonth = classDates[0] ? monthOf(classDates[0]) : null
  const lastMonth = (deadline ?? classDates[classDates.length - 1])?.slice(0, 7) ?? null
  const inRange = (key) => Boolean(firstMonth && lastMonth && key >= firstMonth && key <= lastMonth)

  const [year, monthNumber] = month.split("-").map(Number)
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const leading = new Date(year, monthNumber - 1, 1).getDay()
  const cells = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${month}-${pad(index + 1)}`),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7))

  // Keyboard moves put DOM focus on the new day once it is on screen.
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    gridRef.current?.querySelector(`[data-day="${cursor}"]`)?.focus()
  }, [cursor])

  const goTo = (target, { focus = false } = {}) => {
    if (target === cursor || !inRange(monthOf(target))) return
    if (monthOf(target) !== month) setDirection(target > cursor ? 1 : -1)
    moveFocus.current = focus
    setCursor(target)
  }

  // Same day number in another month (or the last day when that month is shorter).
  const shiftMonth = (delta, options) => {
    const target = new Date(year, monthNumber - 1 + delta, 1)
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    target.setDate(Math.min(Number(cursor.slice(-2)), last))
    goTo(toISO(target), options)
  }

  const shiftDays = (delta) => {
    const target = parse(cursor)
    target.setDate(target.getDate() + delta)
    return toISO(target)
  }

  const handleKeyDown = (event) => {
    const dayOfWeek = parse(cursor).getDay()
    const dayNumber = Number(cursor.slice(-2))
    const moves = {
      ArrowLeft: () => goTo(shiftDays(-1), { focus: true }),
      ArrowRight: () => goTo(shiftDays(1), { focus: true }),
      ArrowUp: () => goTo(shiftDays(-7), { focus: true }),
      ArrowDown: () => goTo(shiftDays(7), { focus: true }),
      // Stay inside the month on screen.
      Home: () => goTo(`${month}-${pad(Math.max(1, dayNumber - dayOfWeek))}`, { focus: true }),
      End: () => goTo(`${month}-${pad(Math.min(daysInMonth, dayNumber + 6 - dayOfWeek))}`, { focus: true }),
      PageUp: () => shiftMonth(-1, { focus: true }),
      PageDown: () => shiftMonth(1, { focus: true }),
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    moves[event.key]()
  }

  const atMax = dates.length >= maxDates

  return (
    <div className="rounded-card border border-line bg-surface px-1 py-2 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => shiftMonth(-1)}
          disabled={!firstMonth || month <= firstMonth}
          aria-label="Previous month"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <p id={headingId} className="font-semibold" aria-live="polite">
          {parse(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => shiftMonth(1)}
          disabled={!lastMonth || month >= lastMonth}
          aria-label="Next month"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>

      {/* The month slides in from the side it came from; no motion when reduced. */}
      <m.div
        key={month}
        initial={reduceMotion ? false : { opacity: 0, x: direction * 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-labelledby={headingId}
          onKeyDown={handleKeyDown}
          className="grid gap-0.5"
        >
          <div role="row" className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map(([short, full]) => (
              <div key={short} role="columnheader" aria-label={full} className="py-1 text-xs font-medium text-muted">
                {short}
              </div>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} role="row" className="grid grid-cols-7 gap-0.5 text-center">
              {week.map((day, index) => {
                if (!day) return <div key={`blank-${index}`} role="gridcell" />
                const eligible = classDates.includes(day)
                const selected = dates.includes(day)
                const isDeadline = day === deadline
                const isToday = day === today
                const pastDeadline = Boolean(deadline && day > deadline && (!termEnd || day <= termEnd))
                const full = !selected && atMax
                const blocked = !eligible || full
                const reason = selected
                  ? null
                  : pastDeadline
                    ? "after the observation deadline"
                    : !eligible
                      ? day < today
                        ? "already passed"
                        : "no class meeting"
                      : full
                        ? `maximum ${maxDates} dates`
                        : null
                return (
                  <div key={day} role="gridcell">
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === cursor ? 0 : -1}
                      aria-pressed={selected}
                      aria-disabled={blocked || undefined}
                      aria-label={`${longDate(day)}${reason ? `, ${reason}` : ""}${isToday ? ", today" : ""}${
                        isDeadline ? ", observation deadline" : ""
                      }`}
                      title={reason ? reason.charAt(0).toUpperCase() + reason.slice(1) : undefined}
                      onClick={() => {
                        setCursor(day)
                        if (!blocked) onToggle(day)
                      }}
                      className={cx(
                        "relative flex h-11 w-full min-w-0 flex-col items-center justify-center rounded-md border text-sm",
                        "transition-[color,background-color,border-color] duration-150",
                        selected && "border-primary-ink bg-primary font-semibold text-primary-fg",
                        !selected && eligible && !full && "border-primary-ink/40 bg-surface font-medium text-ink hover:bg-surface-2",
                        !selected && eligible && full && "border-line bg-surface-2 text-muted",
                        !selected && !eligible && "border-transparent text-muted/60",
                        pastDeadline && !selected && "bg-surface-2 line-through",
                        isDeadline && !selected && "border-accent",
                        isToday && "ring-2 ring-inset ring-ink",
                        blocked && "cursor-not-allowed",
                      )}
                    >
                      {Number(day.slice(-2))}
                      {selected && <Check aria-hidden="true" className="absolute right-1 top-1 h-3 w-3" />}
                      {isDeadline && (
                        <span
                          className={cx(
                            "hidden text-[9px] font-medium leading-none sm:block",
                            selected ? "text-primary-fg" : "text-warning",
                          )}
                        >
                          deadline
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </m.div>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-primary-ink/40 bg-surface" /> Class meeting
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-primary-ink bg-primary" /> Offered
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-sm ring-2 ring-inset ring-ink" /> Today
        </span>
        {deadline && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-accent" /> Deadline
          </span>
        )}
      </p>
    </div>
  )
}

export default DateCalendar
