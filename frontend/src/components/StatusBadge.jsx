const TONES = {
  neutral: "bg-gray-100 text-muted",
  info: "bg-sky-50 text-sky-800",
  warn: "bg-amber-50 text-utd-orange",
  good: "bg-emerald-50 text-utd-green-dark",
  done: "bg-utd-green text-white",
  bad: "bg-red-50 text-red-700",
}

// `map` is one of the status maps in lib/format.js (ASSESSMENT_STATUS, …).
function StatusBadge({ status, map }) {
  const entry = map[status] ?? { label: status, tone: "neutral" }
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${TONES[entry.tone]}`}
    >
      {entry.label}
    </span>
  )
}

export default StatusBadge
