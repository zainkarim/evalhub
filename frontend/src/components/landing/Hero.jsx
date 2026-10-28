import { ArrowRight, ChevronDown } from "lucide-react"
import { m } from "motion/react"
import { useLayoutEffect, useRef } from "react"
import { Button } from "../ui"
import Sparkles from "./Sparkles"

const WORDMARK = "EvalHub".split("")
const INTRO_SCALE = 1.45

// The first screen. Its final state is what the DOM always contains (h1,
// headline, subtext, buttons). While the intro plays, `playing` is true and:
//  - the wordmark group is parked in the middle of the screen and a bit larger
//    (a transform, set before the first paint), then slides to its own place at
//    2.8 s (Web Animations API, transform only, so nothing reflows);
//  - the letters, tagline, sparkles and the rest of the hero fade in on a timeline.
// With `playing` false (skipped, seen before, or reduced motion) nothing animates.
function Hero({ playing }) {
  const groupRef = useRef(null)

  useLayoutEffect(() => {
    if (!playing) return undefined
    const element = groupRef.current
    const rect = element.getBoundingClientRect()
    const dy = window.innerHeight / 2 - (rect.top + rect.height / 2)
    const animation = element.animate(
      [{ transform: `translateY(${dy}px) scale(${INTRO_SCALE})` }, { transform: "none" }],
      { delay: 2800, duration: 700, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "both" },
    )
    return () => animation.cancel()
  }, [playing])

  const scrollToHowItWorks = (event) => {
    event.preventDefault()
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }

  const appear = (delay, rise = 0) => ({
    initial: playing ? { opacity: 0, y: rise } : false,
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.6, ease: "easeOut" },
  })

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center px-4 pb-24 pt-24 text-center sm:px-6">
      {/* The scrim stays hidden while the intro plays (it would sit under a moving
          element), then fades in. */}
      <div
        data-intro={playing}
        className="sky-scrim w-full max-w-3xl before:transition-opacity before:duration-500 data-[intro=true]:before:opacity-0"
      >
        <div ref={groupRef} className="relative">
          <h1
            aria-label="EvalHub"
            className="font-display font-semibold tracking-tight"
            // Inline: the global `main h1:first-of-type` size would otherwise win.
            style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", lineHeight: 1 }}
          >
            {WORDMARK.map((letter, index) => (
              <m.span
                key={index}
                aria-hidden="true"
                className="inline-block"
                initial={playing ? { opacity: 0, y: 12, filter: "blur(8px)" } : false}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.8 + index * 0.06, duration: 0.5, ease: "easeOut" }}
              >
                {letter}
              </m.span>
            ))}
          </h1>
          <m.p className="mt-3 text-sm text-muted sm:text-base" {...appear(2.2)}>
            Faculty peer observation · UT Dallas ECS
          </m.p>
          {playing && <Sparkles />}
        </div>

        <m.div {...appear(2.9, 16)}>
          <p className="mt-10 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Faculty peer observation, without the paperwork.
          </p>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
            Schedule classroom observations, evaluate on one shared scale, and give the Assessment
            Committee a clear view of who is due, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button to="/login" iconRight={ArrowRight}>
              Sign in
            </Button>
            <a
              href="#how-it-works"
              onClick={scrollToHowItWorks}
              className="inline-flex min-h-10 items-center rounded-md px-4 text-sm font-medium text-ink hover:bg-surface-2"
            >
              How it works
            </a>
          </div>
        </m.div>
      </div>

      <ChevronDown
        aria-hidden="true"
        className="absolute bottom-6 left-1/2 h-5 w-5 -translate-x-1/2 text-muted motion-safe:animate-bounce"
      />
    </section>
  )
}

export default Hero
