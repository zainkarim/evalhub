// Starfield engine: draws stars and comets on a transparent <canvas>. The sky
// itself (gradient + glows) is CSS on the canvas element, so this file only
// paints dots. Everything it starts (timers, listeners, observers) is stopped
// by destroy().
//
// How it stays cheap:
//  - The still stars are painted once into an offscreen canvas ("base layer").
//  - Idle: no requestAnimationFrame. A 100 ms timer repaints only the small
//    squares around the few twinkling stars ("dirty rectangles").
//  - While a comet flies (~1.5 s): requestAnimationFrame, blit base + twinkles +
//    comet sprite; then back to idle.
//  - Hidden tab: all timers stop. Reduced motion: one static paint, no timers.
//
// Readability: stars use their full brightness everywhere. Text that would sit
// directly on the sky is not this file's problem: it must be inside a surface
// or a ".sky-scrim" (see index.css), and lib/skyTextCheck.js warns in dev when
// it is not.

const DPR_CAP = 1.5
const RESIZE_DEBOUNCE_MS = 150
const IDLE_TICK_MS = 100
const MIN_GAP = 0.012 // minimum star spacing (fraction of the screen), so two stars never stack
const GLOW_EXTRA = 3 // dark mode: near stars get a soft halo this many px beyond their edge
const GLOW_SHARE = 0.3 // part of a near star's alpha budget spent on the halo (core gets the rest)
const COMET_SIZE = {
  dark: { length: 220, thick: 6, head: 1.9 },
  light: { length: 280, thick: 8, head: 2.4 }, // a little bigger so it reads on the pale sky
}

// Per theme: the brightest a star may be, and the comet's peak alpha.
const ALPHA = {
  dark: { max: 0.9, comet: 0.95 },
  light: { max: 0.85, comet: 0.9 },
}

// Light-mode stars are drawn a bit larger than dark-mode ones (the dark sky has the glow).
const RADIUS_SCALE = { dark: 1, light: 1.2 }

const VARIANTS = {
  app: { divisor: 12000, max: 170, comet: [12000, 20000] },
  hero: { divisor: 5000, max: 380, comet: [6000, 10000] },
}

// Depth layers: radius in CSS px, share of the stars, brightness factor.
const LAYERS = [
  { r: 0.77, share: 0.6, f: 0.45 },
  { r: 1.19, share: 0.3, f: 0.7 },
  { r: 1.82, share: 0.1, f: 1 },
]

// Small seeded random generator, so the sky is the same on every load/resize.
function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Star positions as 0-1 fractions, generated once at the largest size.
function makeStars(count) {
  const random = mulberry32(20240611)
  const stars = []
  let guard = 0
  while (stars.length < count && guard < count * 60) {
    guard += 1
    const x = random()
    const y = random()
    if (stars.some((s) => Math.abs(s.x - x) < MIN_GAP && Math.abs(s.y - y) < MIN_GAP)) continue
    const pick = random()
    const layer = pick < LAYERS[0].share ? 0 : pick < LAYERS[0].share + LAYERS[1].share ? 1 : 2
    stars.push({
      x,
      y,
      layer,
      twinkle: layer > 0 && random() < 0.4, // ~12% of all stars
      period: 4000 + random() * 5000,
      phase: random() * Math.PI * 2,
    })
  }
  return stars
}

function parseTriplet(value, fallback) {
  const parts = value.trim().split(/\s+/).map(Number)
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback
}

function parseHex(value, fallback) {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return fallback
  const n = parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function createStarfield(canvas, { variant = "app" } = {}) {
  const config = VARIANTS[variant] ?? VARIANTS.app
  const ctx = canvas.getContext("2d")
  const allStars = makeStars(config.max)
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

  let width = 0
  let height = 0
  let dpr = 1
  let theme = "light"
  let colors = null
  let stars = [] // visible stars with their pixel position and alpha
  let twinkles = []
  let base = null // offscreen canvas with the still stars
  let sprite = null // pre-drawn comet
  let glow = null // pre-drawn halo for near stars (dark mode only)
  let cometSize = COMET_SIZE.dark
  let comet = null
  let nextCometAt = 0
  let idleTimer = 0
  let frame = 0
  let resizeTimer = 0
  let destroyed = false
  let reduced = reducedQuery.matches

  const devStats = import.meta.env.DEV ? { frames: 0, drawMs: 0, comets: 0 } : null
  if (devStats) canvas.__starfieldStats = devStats

  function readColors() {
    const style = getComputedStyle(canvas)
    theme = document.documentElement.classList.contains("dark") ? "dark" : "light"
    colors = {
      star: parseTriplet(style.getPropertyValue("--c-star"), [255, 255, 255]),
      head: parseTriplet(style.getPropertyValue("--c-comet-head"), [255, 255, 255]),
      accent: parseHex(style.getPropertyValue("--c-accent"), [232, 117, 0]),
    }
  }

  function layout() {
    width = canvas.clientWidth
    height = canvas.clientHeight
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))

    const count = Math.min(config.max, Math.round((width * height) / config.divisor))
    stars = allStars.slice(0, count).map((s) => ({
      ...s,
      px: s.x * width,
      py: s.y * height,
      alpha: ALPHA[theme].max * LAYERS[s.layer].f,
      r: LAYERS[s.layer].r * RADIUS_SCALE[theme],
    }))
    twinkles = reduced ? [] : stars.filter((s) => s.twinkle)
    buildGlow()
    paintBase()
    buildSprite()
    blitBase()
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`
  }

  function dot(target, s, alpha) {
    if (glow && s.layer === 2) {
      // Halo and core share the star's alpha budget, so the brightest pixel never exceeds it.
      const g = s.r + GLOW_EXTRA
      const halo = alpha * GLOW_SHARE
      target.globalAlpha = halo
      target.drawImage(glow, s.px - g, s.py - g, g * 2, g * 2)
      target.globalAlpha = 1
      alpha = (alpha - halo) / (1 - halo) // core + halo together peak at exactly `alpha`
    }
    target.fillStyle = rgba(colors.star, alpha)
    target.beginPath()
    target.arc(s.px, s.py, s.r, 0, Math.PI * 2)
    target.fill()
  }

  // Soft white halo, drawn once per theme (dark mode only); dot() reuses it for every near star.
  function buildGlow() {
    glow = null
    if (theme !== "dark") return
    const g = LAYERS[2].r + GLOW_EXTRA
    glow = document.createElement("canvas")
    glow.width = glow.height = Math.ceil(g * 2 * dpr)
    const c = glow.getContext("2d")
    const radius = glow.width / 2
    const gradient = c.createRadialGradient(radius, radius, 0, radius, radius, radius)
    gradient.addColorStop(0, rgba(colors.star, 1))
    gradient.addColorStop(0.4, rgba(colors.star, 0.4))
    gradient.addColorStop(1, rgba(colors.star, 0))
    c.fillStyle = gradient
    c.fillRect(0, 0, glow.width, glow.height)
  }

  function paintBase() {
    base = document.createElement("canvas")
    base.width = canvas.width
    base.height = canvas.height
    const b = base.getContext("2d")
    b.scale(dpr, dpr)
    // With reduced motion nothing twinkles, so every star is part of the still sky.
    for (const s of stars) if (reduced || !s.twinkle) dot(b, s, s.alpha)
  }

  // The comet is drawn once, horizontally, head on the right; frames just rotate and move it.
  function buildSprite() {
    cometSize = COMET_SIZE[theme]
    const { length, thick } = cometSize
    sprite = document.createElement("canvas")
    sprite.width = Math.round(length * dpr)
    sprite.height = Math.round(thick * dpr)
    const c = sprite.getContext("2d")
    c.scale(dpr, dpr)
    const gradient = c.createLinearGradient(0, 0, length, 0)
    // Dark: white head, tail fading through orange. Light: orange all the way, fading to transparent orange.
    const end = theme === "dark" ? colors.head : colors.accent
    gradient.addColorStop(0, rgba(colors.accent, 0))
    gradient.addColorStop(0.55, rgba(colors.accent, 0.5))
    gradient.addColorStop(1, rgba(end, 1))
    c.fillStyle = gradient
    c.beginPath()
    c.moveTo(0, thick / 2)
    c.lineTo(length - 2, 0.6)
    c.lineTo(length - 2, thick - 0.6)
    c.closePath()
    c.fill()
    c.fillStyle = rgba(colors.head, 1)
    c.beginPath()
    c.arc(length - 2.2, thick / 2, cometSize.head, 0, Math.PI * 2)
    c.fill()
  }

  function blitBase() {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (base) ctx.drawImage(base, 0, 0)
    ctx.scale(dpr, dpr)
  }

  function twinkleAlpha(s, now) {
    const wave = 0.5 + 0.5 * Math.sin((now / s.period) * Math.PI * 2 + s.phase)
    return s.alpha * (0.35 + 0.65 * wave) // never above the star's own limit
  }

  function drawTwinkles(now) {
    for (const s of twinkles) dot(ctx, s, twinkleAlpha(s, now))
  }

  // Idle repaint: restore the tiny square around each twinkling star, redraw it.
  function idlePaint(now) {
    const started = devStats ? performance.now() : 0
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    for (const s of twinkles) {
      const x = Math.floor((s.px - 6) * dpr)
      const y = Math.floor((s.py - 6) * dpr)
      const size = Math.ceil(12 * dpr)
      ctx.clearRect(x, y, size, size)
      ctx.drawImage(base, x, y, size, size, x, y, size, size)
    }
    ctx.scale(dpr, dpr)
    drawTwinkles(now)
    if (devStats) {
      devStats.frames += 1
      devStats.drawMs += performance.now() - started
    }
  }

  function randomBetween(a, b) {
    return a + Math.random() * (b - a)
  }

  function scheduleComet(now) {
    const [min, max] = config.comet
    const scale = theme === "light" ? 2 : 1 // rarer in light mode
    nextCometAt = now + randomBetween(min, max) * scale
  }

  function startComet(now) {
    const angle = (randomBetween(20, 50) * Math.PI) / 180
    const direction = Math.random() < 0.5 ? 1 : -1
    comet = {
      x: randomBetween(0.1, 0.9) * width,
      y: randomBetween(0, 0.5) * height,
      vx: Math.cos(angle) * direction * 760,
      vy: Math.sin(angle) * 760,
      angle: direction > 0 ? angle : Math.PI - angle,
      start: now,
      duration: randomBetween(1200, 2000),
    }
    if (devStats) devStats.comets += 1
  }

  function cometFrame(now) {
    frame = 0
    if (destroyed || !comet) return
    const started = devStats ? performance.now() : 0
    const t = (now - comet.start) / comet.duration
    blitBase()
    drawTwinkles(now)
    if (t < 1) {
      const seconds = (now - comet.start) / 1000
      const fade = Math.min(1, t / 0.2, (1 - t) / 0.2)
      ctx.save()
      ctx.globalAlpha = ALPHA[theme].comet * Math.max(0, fade)
      ctx.translate(comet.x + comet.vx * seconds, comet.y + comet.vy * seconds)
      ctx.rotate(comet.angle)
      ctx.drawImage(sprite, -cometSize.length, -cometSize.thick / 2, cometSize.length, cometSize.thick)
      ctx.restore()
    }
    if (devStats) {
      devStats.frames += 1
      devStats.drawMs += performance.now() - started
    }
    if (t >= 1) {
      comet = null
      scheduleComet(now)
      idleTimer = window.setTimeout(idleTick, IDLE_TICK_MS)
      return
    }
    frame = requestAnimationFrame(cometFrame)
  }

  function idleTick() {
    idleTimer = 0
    if (destroyed || document.hidden || reduced) return
    const now = performance.now()
    if (now >= nextCometAt) {
      startComet(now)
      frame = requestAnimationFrame(cometFrame)
      return
    }
    idlePaint(now)
    idleTimer = window.setTimeout(idleTick, IDLE_TICK_MS)
  }

  function stopLoop() {
    window.clearTimeout(idleTimer)
    idleTimer = 0
    cancelAnimationFrame(frame)
    frame = 0
  }

  function startLoop() {
    stopLoop()
    if (destroyed || document.hidden || reduced) return
    if (comet) comet = null
    scheduleComet(performance.now())
    idleTimer = window.setTimeout(idleTick, IDLE_TICK_MS)
  }

  function rebuild() {
    stopLoop()
    readColors()
    layout()
    startLoop()
  }

  function onResize() {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      // Mobile address bars fire resize constantly; only react to a real size change.
      if (canvas.clientWidth !== width || canvas.clientHeight !== height) rebuild()
    }, RESIZE_DEBOUNCE_MS)
  }

  function onVisibility() {
    if (document.hidden) stopLoop()
    else startLoop()
  }

  function onMotionChange(event) {
    reduced = event.matches
    rebuild()
  }

  // Fires after the theme class is toggled on <html>, so the colours read are the new ones.
  const themeObserver = new MutationObserver(() => {
    const next = document.documentElement.classList.contains("dark") ? "dark" : "light"
    if (next !== theme) rebuild()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  window.addEventListener("resize", onResize)
  document.addEventListener("visibilitychange", onVisibility)
  reducedQuery.addEventListener("change", onMotionChange)

  // Dev only: lets the test scripts fly a comet on demand.
  const onTestComet = import.meta.env.DEV
    ? () => {
        if (!comet && !reduced && !document.hidden) {
          window.clearTimeout(idleTimer)
          idleTimer = 0
          startComet(performance.now())
          frame = requestAnimationFrame(cometFrame)
        }
      }
    : null
  if (onTestComet) canvas.addEventListener("starfield:comet", onTestComet)

  rebuild()

  return {
    destroy() {
      destroyed = true
      stopLoop()
      window.clearTimeout(resizeTimer)
      themeObserver.disconnect()
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibility)
      reducedQuery.removeEventListener("change", onMotionChange)
      if (onTestComet) canvas.removeEventListener("starfield:comet", onTestComet)
      base = null
      sprite = null
      glow = null
    },
  }
}
