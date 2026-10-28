import { useId } from "react"

// A four-point sparkle with concave sides (drawn on a 24-unit grid), in the gold
// tokens: --c-gold for the body, --c-gold-core for the centre highlight. Decorative:
// aria-hidden. `halo` draws a soft gold glow behind it as a radial gradient (not a
// filter, so scaling a sparkle never re-blurs anything); its strength is --c-gold-halo.
export const STAR_PATH = "M12 0C12.7 7.6 16.4 11.3 24 12C16.4 12.7 12.7 16.4 12 24C11.3 16.4 7.6 12.7 0 12C7.6 11.3 11.3 7.6 12 0Z"

function GoldStar({ size = 12, halo = true, className = "", style }) {
  const id = useId()
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ overflow: "visible", ...style }}
    >
      {halo && (
        <>
          <defs>
            <radialGradient id={id}>
              <stop offset="0" style={{ stopColor: "var(--c-gold)" }} />
              <stop offset="1" style={{ stopColor: "var(--c-gold)", stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="20" fill={`url(#${id})`} style={{ opacity: "var(--c-gold-halo)" }} />
        </>
      )}
      <path d={STAR_PATH} style={{ fill: "var(--c-gold)" }} />
      <circle cx="12" cy="12" r="2.4" style={{ fill: "var(--c-gold-core)" }} />
    </svg>
  )
}

export default GoldStar
