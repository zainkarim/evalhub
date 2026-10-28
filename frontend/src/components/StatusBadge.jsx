import { Check } from "lucide-react"
import { normalizeStatus } from "../lib/format"
import { Badge } from "./ui"

// The status maps in lib/format.js use these tone names; the kit Badge uses its
// own. "done" is the one solid badge, because a completed record is final.
const TONE = {
  neutral: "neutral",
  info: "info",
  warn: "warning",
  good: "success",
  bad: "danger",
  done: "solid",
}

// A status nobody mapped still reads as words, never as a raw key.
const humanize = (status) => {
  const text = String(status ?? "").replace(/_/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// `map` is one of the status maps in lib/format.js (ASSESSMENT_STATUS, ...).
function StatusBadge({ status, map }) {
  const entry = map[normalizeStatus(status)] ?? { label: humanize(status), tone: "neutral" }
  const tone = TONE[entry.tone] ?? "neutral"
  return (
    <Badge tone={tone} dot={tone !== "solid"}>
      {tone === "solid" && <Check aria-hidden="true" className="h-3 w-3" />}
      {entry.label}
    </Badge>
  )
}

export default StatusBadge
