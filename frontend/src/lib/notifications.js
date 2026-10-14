// Where a notification leads (#62: "open the related observation directly").
// A notification with an observation record opens that record; a request sent
// to (or withdrawn from) an observer opens their inbox; anything else opens the
// sign-up it is about.
export function notificationLink(notification) {
  if (notification.observationId) return `/records/${notification.observationId}`
  if (notification.type === "request_sent" || notification.type === "request_withdrawn") {
    return "/observations"
  }
  if (notification.assessmentId) return `/assessments/${notification.assessmentId}`
  return "/observations"
}

// "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then "Oct 9".
export function timeAgo(timestamp, now = Date.now()) {
  if (!timestamp) return ""
  const then = new Date(timestamp).getTime()
  const minutes = Math.floor((now - then) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
