// A tapered comet tail as an SVG path: it starts as a (2 * w)-wide base centred on the
// head (hx, hy), curves in slightly and ends in a point at the tip (tx, ty).
// Shared by the hero's mini comets (landing/HubDecor) and the compact wordmark.
export function cometTail(hx, hy, tx, ty, w) {
  const dx = tx - hx
  const dy = ty - hy
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const mx = hx + dx * 0.4
  const my = hy + dy * 0.4
  const f = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`
  return `M${f(hx + nx * w, hy + ny * w)}Q${f(mx + nx * w * 0.3, my + ny * w * 0.3)} ${f(tx, ty)}Q${f(mx - nx * w * 0.3, my - ny * w * 0.3)} ${f(hx - nx * w, hy - ny * w)}Z`
}
