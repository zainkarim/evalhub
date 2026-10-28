import { m } from "motion/react"
import { useId } from "react"
import { cometTail } from "../brand/cometPath"
import { STAR_PATH } from "../brand/GoldStar"

// The decoration above "Hub" in the hero title: two tiny comets (gold head, short
// orange tail, angled up and to the right) and three gold sparkles. It is an SVG laid
// over the "Hub" box, drawn in 1/100 em (the box is 1em tall, y = 0 is its top; the
// cap height sits at y 14 and the baseline at y 85), so it scales with the title.
// Part of the final lockup (it stays); `intro` only adds the entrance. Decorative.

const COMETS = [
  { hx: 51, hy: 30, tx: 112, ty: -26, w: 4.6, r: 6.4, delay: 2.1 }, // in the gap of the cut "H"
  { hx: 17, hy: -9, tx: 41, ty: -31, w: 2.6, r: 3.3, delay: 2.25 },
]
const SPARKLES = [
  { x: 101, y: 12, size: 15, delay: 2.4 },
  { x: 80, y: -22, size: 8, delay: 2.5 },
  { x: 150, y: -5, size: 9, delay: 2.6 },
]

function HubDecor({ intro }) {
  const id = useId()
  const G = intro ? m.g : "g"
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 100"
      className="pointer-events-none absolute left-0 top-0 h-[1em] w-[2em]"
      style={{ overflow: "visible" }}
    >
      <defs>
        {COMETS.map((c, index) => (
          <linearGradient key={index} id={`${id}${index}`} gradientUnits="userSpaceOnUse" x1={c.hx} y1={c.hy} x2={c.tx} y2={c.ty}>
            <stop offset="0" style={{ stopColor: "var(--c-gold-core)" }} />
            <stop offset="0.3" style={{ stopColor: "var(--c-gold)" }} />
            <stop offset="0.7" style={{ stopColor: "var(--c-accent)", stopOpacity: 0.85 }} />
            <stop offset="1" style={{ stopColor: "var(--c-accent)", stopOpacity: 0 }} />
          </linearGradient>
        ))}
      </defs>
      {COMETS.map((c, index) => (
        <G
          key={index}
          {...(intro
            ? {
                initial: { opacity: 0, x: -14, y: 14 },
                animate: { opacity: 1, x: 0, y: 0 },
                transition: { delay: c.delay, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] },
              }
            : {})}
        >
          <path d={cometTail(c.hx, c.hy, c.tx, c.ty, c.w)} fill={`url(#${id}${index})`} />
          <circle cx={c.hx} cy={c.hy} r={c.r * 1.9} style={{ fill: "var(--c-gold)", opacity: 0.25 }} />
          <circle cx={c.hx} cy={c.hy} r={c.r} style={{ fill: "var(--c-gold)" }} />
          <circle cx={c.hx} cy={c.hy} r={c.r * 0.5} style={{ fill: "var(--c-gold-core)" }} />
        </G>
      ))}
      {SPARKLES.map((s, index) => (
        <G
          key={index}
          {...(intro
            ? {
                initial: { opacity: 0, scale: 0 },
                animate: { opacity: 1, scale: [0, 1.15, 1] },
                transition: { delay: s.delay, duration: 0.45, ease: "easeOut" },
                style: { transformBox: "fill-box", transformOrigin: "center" },
              }
            : {})}
        >
          <g transform={`translate(${s.x - s.size / 2} ${s.y - s.size / 2}) scale(${s.size / 24})`}>
            <path d={STAR_PATH} style={{ fill: "var(--c-gold)" }} />
            <circle cx="12" cy="12" r="2.6" style={{ fill: "var(--c-gold-core)" }} />
          </g>
        </G>
      ))}
    </svg>
  )
}

export default HubDecor
