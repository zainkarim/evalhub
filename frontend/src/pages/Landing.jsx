import { CalendarCheck, ClipboardList, LayoutDashboard } from "lucide-react"
import { m, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import BrandMark from "../components/BrandMark"
import FeatureCard from "../components/landing/FeatureCard"
import Hero from "../components/landing/Hero"
import IntroSequence from "../components/landing/IntroSequence"
import WorkflowStrip from "../components/landing/WorkflowStrip"
import Starfield from "../components/Starfield"
import ThemeToggle from "../components/ThemeToggle"
import { Button, Card } from "../components/ui"
import { useAuth } from "../context/auth-context"

const INTRO_MS = 3500

// Fade + small rise when the block scrolls into view (once).
function Reveal({ children, delay = 0, className }) {
  const reduceMotion = useReducedMotion()
  return (
    <m.div
      className={className}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </m.div>
  )
}

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Scheduling that fits your classes",
    text: "Pick your observer and offer dates on your actual class meeting days, up to the term's observation deadline. Your observer confirms one.",
  },
  {
    icon: ClipboardList,
    title: "One clear evaluation scale",
    text: "Every criterion uses the same 1–5 scale. Observers see their own answers; you see them once your observer signs.",
  },
  {
    icon: LayoutDashboard,
    title: "Oversight for the committee",
    text: "See who is due or overdue, start observer selection after the sign-up deadline, send reminders, and get alerted when a course is short on observers.",
  },
]

// The public page for logged-out visitors. The whole page is in the DOM from the
// first render; the intro (comet, wordmark reveal) only animates visibility and
// transforms. It plays every time the page is opened (also when coming back from
// the login page), never with reduced motion, and any key, click, tap or wheel
// skips straight to the final state.
function LandingPage() {
  const { user, restoring } = useAuth()
  const reduced = useReducedMotion()
  const [playing, setPlaying] = useState(() => !reduced)
  const [skipped, setSkipped] = useState(false)

  const skip = useCallback(() => {
    setSkipped(true)
    setPlaying(false)
  }, [])

  useEffect(() => {
    // Wait for the session check: nothing is on screen until it is done.
    if (!playing || restoring) return undefined
    const timer = window.setTimeout(() => setPlaying(false), INTRO_MS)
    return () => window.clearTimeout(timer)
  }, [playing, restoring])

  if (restoring) return <div className="min-h-screen" />
  if (user) return <Navigate to="/" replace />

  return (
    <div className="relative overflow-x-clip font-sans text-ink">
      <Starfield variant="hero" />
      {/* Changing the key rebuilds the page in its final state (that is how a skip lands). */}
      <div key={skipped ? "final" : "intro"}>
        <a
          href="#main-content"
          onClick={(event) => {
            event.preventDefault()
            document.getElementById("main-content")?.focus()
          }}
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
        >
          Skip to content
        </a>
        {playing && <IntroSequence onSkip={skip} />}

        <header className="absolute inset-x-0 top-0 z-30">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <m.div
              className="sky-scrim"
              initial={playing ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: 3, duration: 0.5 }}
            >
              <BrandMark />
            </m.div>
            <ThemeToggle className="bg-surface ring-1 ring-line" />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <Hero playing={playing} />

          <section id="how-it-works" className="scroll-mt-8 px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-5xl">
              <div className="sky-scrim mx-auto max-w-2xl text-center">
                <Reveal>
                  <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    Built around how peer observation actually works
                  </h2>
                </Reveal>
              </div>
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {FEATURES.map((feature, index) => (
                  <Reveal key={feature.title} delay={index * 0.05} className="h-full">
                    <FeatureCard icon={feature.icon} title={feature.title}>
                      {feature.text}
                    </FeatureCard>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section className="px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-5xl">
              <div className="sky-scrim mx-auto max-w-2xl text-center">
                <Reveal>
                  <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    From sign-up to sign-off
                  </h2>
                </Reveal>
              </div>
              <div className="mt-10">
                <WorkflowStrip />
              </div>
              <div className="sky-scrim mx-auto mt-8 max-w-xl text-center">
                <p className="text-sm text-muted">
                  If an attempt falls through, it&apos;s kept as a postponed record, never deleted.
                </p>
              </div>
            </div>
          </section>

          <section className="px-4 py-16 sm:px-6">
            <Reveal>
              <Card className="mx-auto max-w-3xl text-center">
                <h2 className="font-display text-2xl font-semibold tracking-tight">Ready to get started?</h2>
                <div className="mt-5 flex justify-center">
                  <Button to="/login">Sign in</Button>
                </div>
              </Card>
            </Reveal>
          </section>
        </main>

        <footer className="border-t border-line bg-surface px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark size={28} />
            <div className="text-sm text-muted sm:text-right">
              <p>Faculty peer observation · UT Dallas ECS</p>
              <p>Erik Jonsson School of Engineering &amp; Computer Science</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

// Every visit gets its own location.key (link, browser Back, same-page navigation),
// so keying the page on it rebuilds it and the intro starts from frame 0 each time.
function Landing() {
  const location = useLocation()
  return <LandingPage key={location.key} />
}

export default Landing
