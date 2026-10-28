import { ArrowRight, ChevronDown } from "lucide-react"
import { m } from "motion/react"
import { useLayoutEffect, useRef } from "react"
import LogoMark from "../brand/LogoMark"
import { Button } from "../ui"
import HubDecor from "./HubDecor"
import Sparkles from "./Sparkles"

const EVAL = "Eval".split("")
const HUB = "Hub".split("")
const INTRO_SCALE = 1.45

// One letter of the title. Every letter is its own inline-block with line-height 1 (see
// .wm-letter in index.css), so the vertical gradient is identical across the word. With
// `playing` it blurs and rises in; the "Hub" letters start dim and ignite (the glow on
// their wrapper follows their opacity).
function Letter({ char, index, playing, hub }) {
  const start = hub ? 1.45 : 1.1
  return (
    <m.span
      aria-hidden="true"
      className={`wm-letter ${hub ? "wm-hub" : "wm-silver"} ${hub && index === 0 ? "wm-h" : ""}`}
      initial={playing ? { opacity: 0, y: 12, filter: "blur(8px)" } : false}
      animate={{
        opacity: hub && playing ? [0, 0.35, 1] : 1,
        y: 0,
        filter: "blur(0px)",
      }}
      transition={{
        delay: start + index * (hub ? 0.08 : 0.07),
        duration: hub ? 0.7 : 0.5,
        times: hub && playing ? [0, 0.55, 1] : undefined,
        ease: "easeOut",
      }}
    >
      {char}
    </m.span>
  )
}

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
          {/* The lockup: mark left, title right (stacked below sm). The h1 is one
              accessible name; the letters and the decoration inside are aria-hidden. */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-7">
            <LogoMark size={136} intro={playing} className="h-28 w-28 sm:h-[8.5rem] sm:w-[8.5rem]" />
            <h1
              aria-label="EvalHub"
              className="font-display font-bold"
              // Inline: the global `main h1:first-of-type` size would otherwise win.
              style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)", lineHeight: 1, letterSpacing: "-0.03em" }}
            >
              <span aria-hidden="true">
                {EVAL.map((char, index) => (
                  <Letter key={index} char={char} index={index} playing={playing} />
                ))}
              </span>
              <span aria-hidden="true" className="wm-hub-glow relative inline-block align-baseline">
                {HUB.map((char, index) => (
                  <Letter key={index} char={char} index={index} playing={playing} hub />
                ))}
                <HubDecor intro={playing} />
              </span>
            </h1>
          </div>
          <m.p
            className="mt-6 text-xs uppercase tracking-[0.2em] text-muted sm:text-sm"
            {...appear(2.3)}
          >
            Faculty peer observation · UT Dallas
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
