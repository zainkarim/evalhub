// A four-point sparkle with concave sides (drawn on a 24-unit grid), in the gold
// tokens: --c-gold for the body, --c-gold-core for the centre highlight. Decorative:
// aria-hidden. `glow` adds the (static) soft gold glow of the dark theme.
export const STAR_PATH = "M12 0C12.7 7.6 16.4 11.3 24 12C16.4 12.7 12.7 16.4 12 24C11.3 16.4 7.6 12.7 0 12C7.6 11.3 11.3 7.6 12 0Z"

function GoldStar({ size = 12, glow = true, className = "", style }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ overflow: "visible", filter: glow ? "var(--c-gold-glow)" : undefined, ...style }}
    >
      <path d={STAR_PATH} style={{ fill: "var(--c-gold)" }} />
      <circle cx="12" cy="12" r="2.4" style={{ fill: "var(--c-gold-core)" }} />
    </svg>
  )
}

export default GoldStar
