import { normalizeStatus } from "../lib/format"

// One pill shape for every status; the tone only changes the colour. "done" is
// the one solid badge, because a completed record is final and locked.
const TONES = {
  neutral: { pill: "bg-surface-2 text-muted ring-line", dot: "bg-muted" },
  info: { pill: "bg-info-soft text-info ring-info/30", dot: "bg-info" },
  warn: { pill: "bg-warning-soft text-warning ring-warning/30", dot: "bg-accent" },
  good: { pill: "bg-success-soft text-success ring-success/30", dot: "bg-primary" },
  done: { pill: "bg-brand text-white ring-brand", dot: null },
  bad: { pill: "bg-danger-soft text-danger ring-danger/30", dot: "bg-danger" },
}

// A status nobody mapped still reads as words, never as a raw key.
const humanize = (status) => {
  const text = String(status ?? "").replace(/_/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// `map` is one of the status maps in lib/format.js (ASSESSMENT_STATUS, …).
function StatusBadge({ status, map }) {
  const entry = map[normalizeStatus(status)] ?? { label: humanize(status), tone: "neutral" }
  const tone = TONES[entry.tone] ?? TONES.neutral
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.pill}`}
    >
      {tone.dot ? (
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      ) : (
        <span aria-hidden="true">✓</span>
      )}
      {entry.label}
    </span>
  )
}

export default StatusBadge
