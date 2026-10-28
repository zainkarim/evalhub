import { useId } from "react"
import { cometTail } from "./cometPath"

// A tiny shooting star in the gap of the cut "H" (see .wm-h in index.css): a gold head
// above the stub of the right stem and a short orange tail pointing up and to the right.
// An SVG laid over the H's 1em box and drawn in 1/100 em, so it scales with the text.
// It sits outside the clipped letter (the clip would cut it). Decorative: aria-hidden.
//
// `tiny` is for text of about 20px and below: just a gold dot and a 2px-wide tail,
// because the details of the full version turn to mush there.
function HComet({ tiny = false }) {
  const id = useId()
  const head = tiny ? { x: 50, y: 29, r: 6.5 } : { x: 50, y: 27, r: 8.5 }
  const tip = tiny ? { x: 66, y: 13 } : { x: 100, y: -16 }
  const half = tiny ? 5 : 4.4
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className="pointer-events-none absolute left-0 top-0 h-[1em] w-[1em]"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={head.x} y1={head.y} x2={tip.x} y2={tip.y}>
          <stop offset="0" style={{ stopColor: "var(--c-gold)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--c-accent)", stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: "var(--c-accent)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={cometTail(head.x, head.y, tip.x, tip.y, half)} fill={`url(#${id})`} />
      <circle cx={head.x} cy={head.y} r={head.r} style={{ fill: "var(--c-gold)" }} />
      {!tiny && <circle cx={head.x} cy={head.y} r={head.r * 0.45} style={{ fill: "var(--c-gold-core)" }} />}
    </svg>
  )
}

export default HComet
