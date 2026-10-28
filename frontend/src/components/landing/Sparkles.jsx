import { m } from "motion/react"

// Six small four-point sparkles around the wordmark; each scales and fades in and
// out once, staggered. Decorative only (aria-hidden), transform and opacity only.
const SPARKLES = [
  { top: "-10%", left: "6%", size: 20, tone: "text-accent" },
  { top: "8%", left: "94%", size: 16, tone: "text-ink" },
  { top: "86%", left: "12%", size: 14, tone: "text-ink" },
  { top: "92%", left: "82%", size: 22, tone: "text-accent" },
  { top: "-18%", left: "70%", size: 14, tone: "text-ink" },
  { top: "48%", left: "-5%", size: 12, tone: "text-accent" },
]

const STAR = "M12 0C12 7 17 12 24 12C17 12 12 17 12 24C12 17 7 12 0 12C7 12 12 7 12 0Z"

function Sparkles({ start = 1.6 }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {SPARKLES.map((item, index) => (
        <m.svg
          key={index}
          viewBox="0 0 24 24"
          width={item.size}
          height={item.size}
          className={`absolute fill-current ${item.tone}`}
          style={{ top: item.top, left: item.left }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{ opacity: [0, 0.95, 0], scale: [0, 1, 0.5], rotate: [0, 45, 90] }}
          transition={{ delay: start + index * 0.11, duration: 0.9, ease: "easeInOut" }}
        >
          <path d={STAR} />
        </m.svg>
      ))}
    </span>
  )
}

export default Sparkles
