import { m } from "motion/react"
import { useId } from "react"

// The big intro comet: a bright head and a long tail, drawn as one SVG. The head
// is at the right end. It flies in a straight line from `from` to `to` (the head's
// position, in viewport pixels) by moving a transform only (no layout properties).
// Colours come from the theme tokens: dark = white head fading to orange; light =
// orange head fading to transparent orange.
function Comet({ from, to, length, delay = 0.2, duration = 1.6 }) {
  const gradientId = useId()
  const height = 16
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI

  return (
    <m.svg
      aria-hidden="true"
      focusable="false"
      width={length}
      height={height}
      viewBox="0 0 300 16"
      preserveAspectRatio="none"
      className="pointer-events-none fixed left-0 top-0 z-10 overflow-visible"
      style={{ originX: 1, originY: 0.5 }}
      initial={{ x: from.x - length, y: from.y - height / 2, rotate: angle }}
      animate={{ x: to.x - length, y: to.y - height / 2, rotate: angle }}
      transition={{ delay, duration, ease: [0.35, 0, 0.3, 1] }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{ stopColor: "var(--c-accent)", stopOpacity: 0 }} />
          <stop offset="0.6" style={{ stopColor: "var(--c-accent)", stopOpacity: 0.6 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--c-comet-head))", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <path d="M0 8 L292 2 L292 14 Z" fill={`url(#${gradientId})`} />
      <circle cx="292" cy="8" r="11" style={{ fill: "rgb(var(--c-comet-head))", opacity: 0.22 }} />
      <circle cx="292" cy="8" r="5.5" style={{ fill: "rgb(var(--c-comet-head))" }} />
    </m.svg>
  )
}

export default Comet
