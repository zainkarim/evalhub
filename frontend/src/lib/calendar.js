// "Add to calendar": builds a one-event .ics file (RFC 5545) that Google
// Calendar, Outlook and Apple Calendar all import. Times are written as local
// "floating" times, so 1:00 PM stays 1:00 PM in the observer's calendar.

// Text values escape \ ; , and newlines.
const escapeText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")

// "2026-11-06" -> "20261106"; with "13:00" -> "20261106T130000"
const icsDate = (day) => day.replaceAll("-", "")
const icsDateTime = (day, time) => `${icsDate(day)}T${time.replace(":", "").padEnd(6, "0").slice(0, 6)}`

function nextDay(day) {
  const [year, month, date] = day.split("-").map(Number)
  const next = new Date(year, month - 1, date + 1)
  const pad = (n) => String(n).padStart(2, "0")
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

function stamp(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

// day: "YYYY-MM-DD"; startTime/endTime: "HH:MM" (optional; without them the
// event is all-day).
export function buildIcs({ uid, day, startTime, endTime, title, location, description }) {
  const timed = Boolean(startTime && endTime)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EvalHub//Observation//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}@evalhub`,
    `DTSTAMP:${stamp()}`,
    timed ? `DTSTART:${icsDateTime(day, startTime)}` : `DTSTART;VALUE=DATE:${icsDate(day)}`,
    timed ? `DTEND:${icsDateTime(day, endTime)}` : `DTEND;VALUE=DATE:${icsDate(nextDay(day))}`,
    `SUMMARY:${escapeText(title)}`,
    location ? `LOCATION:${escapeText(location)}` : null,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean)
  return `${lines.join("\r\n")}\r\n`
}

// Hands the file to the browser as a download.
export function downloadIcs(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
