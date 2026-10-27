import { normalizeStatus } from "../lib/format"

// One pill shape for every status; the tone only changes the colour. "done" is
// the one solid badge, because a completed record is final and locked.
const TONES = {
  neutral: { pill: "bg-gray-50 text-gray-700 ring-gray-200", dot: "bg-gray-400" },
  info: { pill: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  warn: { pill: "bg-orange-50 text-utd-orange ring-orange-200", dot: "bg-utd-orange" },
  good: { pill: "bg-emerald-50 text-utd-green-dark ring-emerald-200", dot: "bg-utd-green" },
  done: { pill: "bg-utd-green-dark text-white ring-utd-green-dark", dot: null },
  bad: { pill: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
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
