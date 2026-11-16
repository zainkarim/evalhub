import { m } from "motion/react"
import { useId } from "react"
import { STAR_PATH } from "./GoldStar"

// The EvalHub mark: a bold green E, a small constellation wrapping its left side and
// bottom, and an orange-gold comet crossing it from the lower left to the upper
// right, plus one sparkle. Hand-built SVG on a 64-unit grid; every colour is a CSS
// variable (see index.css), so it follows the theme.
//
// At size <= 32 a simpler variant is drawn (no constellation, no speckles) so it stays
// crisp in the header. `intro` plays the landing entrance (the E fades and scales in,
// the constellation draws in, the stars pop, the comet streaks in); without it
// nothing animates.

const E_PATH = "M16 9H50V19H27V27H43V37H27V45H52V55H16Z"
const TAIL = "M6.5 47.7Q25 31 53 8Q31.3 37.1 15.5 56.3Z"
const TAIL_INNER = "M9.5 50.5Q26 35 48 12Q30 39 12.6 54Z"

const LINES = ["M25 5L14 12L5 24L9 40", "M20 60L35 59L47 49"]
const STARS = [
  { x: 25, y: 5, r: 3 },
  { x: 14, y: 12, r: 3.4 },
  { x: 5, y: 24, r: 4.2 },
  { x: 35, y: 59, r: 4.4 },
  { x: 47, y: 49, r: 3.2 },
]

function Star({ x, y, r }) {
  const k = (r * 2) / 24
  return (
    <g transform={`translate(${x - r} ${y - r}) scale(${k})`}>
      <path d={STAR_PATH} style={{ fill: "var(--c-gold)" }} />
      <circle cx="12" cy="12" r="2.6" style={{ fill: "var(--c-gold-core)" }} />
    </g>
  )
}

function LogoMark({ size = 32, intro = false, className = "" }) {
  const id = useId()
  const simple = size <= 32
  // `Part` is a motion element during the intro and a plain SVG element otherwise.
  const G = intro ? m.g : "g"
  const Path = intro ? m.path : "path"
  const pop = (delay) =>
    intro
      ? {
          initial: { opacity: 0, scale: 0 },
          animate: { opacity: 1, scale: [0, 1.25, 1] },
          transition: { delay, duration: 0.4, ease: "easeOut" },
          style: { transformBox: "fill-box", transformOrigin: "center" },
        }
      : {}

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`${id}e`} x1="0" y1="9" x2="0" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--c-logo-e-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--c-logo-e-bottom)" }} />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="11" y1="52" x2="53" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--c-gold-core)" }} />
          <stop offset="0.3" style={{ stopColor: "var(--c-gold)" }} />
          <stop offset="0.65" style={{ stopColor: "var(--c-accent)", stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: "var(--c-accent)", stopOpacity: 0 }} />
        </linearGradient>
        <radialGradient id={`${id}h`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" style={{ stopColor: "var(--c-gold)" }} />
          <stop offset="1" style={{ stopColor: "var(--c-accent)" }} />
        </radialGradient>
        <radialGradient id={`${id}g`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.3" style={{ stopColor: "var(--c-gold)", stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: "var(--c-gold)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      {!simple && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--c-logo-line)" }} strokeWidth="1.2">
          {LINES.map((d, index) => (
            <Path
              key={d}
              d={d}
              {...(intro
                ? {
                    initial: { pathLength: 0, opacity: 0 },
                    animate: { pathLength: 1, opacity: 1 },
                    transition: { delay: 0.55 + index * 0.15, duration: 0.7, ease: "easeInOut" },
                  }
                : {})}
            />
          ))}
        </g>
      )}

      <G
        {...(intro
          ? {
              initial: { opacity: 0, scale: 0.85 },
              animate: { opacity: 1, scale: 1 },
              transition: { delay: 0.3, duration: 0.5, ease: "easeOut" },
              style: { transformBox: "fill-box", transformOrigin: "center" },
            }
          : {})}
      >
        <path d={E_PATH} fill={`url(#${id}e)`} strokeLinejoin="round" strokeWidth="1.2" style={{ stroke: "var(--c-logo-e-edge)" }} />
      </G>

      {!simple &&
        STARS.map((star, index) => (
          <G key={index} {...pop(0.95 + index * 0.08)}>
            <Star {...star} />
          </G>
        ))}

      <G
        {...(intro
          ? {
              initial: { opacity: 0, x: -16, y: 16 },
              animate: { opacity: 1, x: 0, y: 0 },
              transition: { delay: 0.9, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] },
            }
          : {})}
      >
        {/* Soft halo: only visible in dark mode (--c-logo-glow is 0 in light). */}
        <circle cx="12" cy="51" r="14" fill={`url(#${id}g)`} style={{ opacity: "var(--c-logo-glow)" }} />
        <path d={TAIL} fill={`url(#${id}t)`} />
        {!simple && <path d={TAIL_INNER} style={{ fill: "var(--c-gold-core)", opacity: 0.55 }} />}
        <circle cx="11" cy="52" r="6.6" fill={`url(#${id}h)`} />
        <circle cx="11" cy="52" r="4.2" fill="#2a1608" />
        {!simple && (
          <g style={{ fill: "var(--c-gold)" }}>
            <circle cx="9.6" cy="50.6" r="0.8" />
            <circle cx="12.6" cy="53.6" r="0.7" />
            <circle cx="12.2" cy="50" r="0.55" />
            <circle cx="9.4" cy="53.8" r="0.5" />
          </g>
        )}
      </G>

      <G {...pop(1.4)}>
        <Star x={57} y={7} r={simple ? 5.5 : 6} />
      </G>
    </svg>
  )
}

export default LogoMark
