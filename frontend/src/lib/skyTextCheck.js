// Dev only (Starfield.jsx imports this lazily under import.meta.env.DEV, so it
// is not in the production bundle).
//
// Rule: any text that sits directly on the starfield must be inside a surface
// (an ancestor with a mostly opaque background) or inside a ".sky-scrim". This
// walks the visible text after the page changes and prints one grouped
// console.warn listing the text that breaks the rule.

const SURFACE_ALPHA = 0.75
const DEBOUNCE_MS = 600

// computed backgroundColor comes back as rgb()/rgba() or color(srgb r g b / a).
function alphaOf(color) {
  if (!color || color === "transparent") return 0
  const slash = /\/\s*([\d.]+)(%?)/.exec(color)
  if (slash) return slash[2] ? Number(slash[1]) / 100 : Number(slash[1])
  const rgba = /^rgba\(([^)]+)\)$/.exec(color)
  if (rgba) return Number(rgba[1].split(",")[3] ?? 1)
  return 1
}

function isSurface(el) {
  return el.classList.contains("sky-scrim") || alphaOf(getComputedStyle(el).backgroundColor) >= SURFACE_ALPHA
}

function describe(el) {
  const classes = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 3) : []
  return el.tagName.toLowerCase() + (classes.length ? "." + classes.join(".") : "")
}

function scan(seen) {
  const cache = new WeakMap() // element -> is it (inside) a surface or scrim?
  const onSurface = (el) => {
    if (!el || el === document.documentElement) return false
    if (cache.has(el)) return cache.get(el)
    const result = el === document.body ? false : isSurface(el) || onSurface(el.parentElement)
    cache.set(el, result)
    return result
  }

  const hits = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim()
    const el = node.parentElement
    if (!text || !el) continue
    if (el.closest("script, style, noscript, canvas, dialog, .sr-only, [aria-hidden='true']")) continue
    if (el.checkVisibility && !el.checkVisibility()) continue
    if (onSurface(el)) continue
    const key = `${location.pathname}|${describe(el)}|${text.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({ element: describe(el), text: text.slice(0, 50), node: el })
  }
  return hits
}

export function startSkyTextCheck() {
  const seen = new Set()
  let timer = 0

  const run = () => {
    timer = 0
    const hits = scan(seen)
    if (hits.length > 0) {
      console.warn(
        `[sky-text] ${hits.length} text element(s) on ${location.pathname} sit directly on the starfield. ` +
          "Put them inside a surface (Card, bg-surface) or a .sky-scrim.",
        hits.map((hit) => ({ element: hit.element, text: hit.text, node: hit.node })),
      )
    }
  }
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(run, DEBOUNCE_MS)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()

  return () => {
    observer.disconnect()
    window.clearTimeout(timer)
  }
}
