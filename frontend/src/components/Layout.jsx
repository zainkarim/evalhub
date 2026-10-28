import { m, useReducedMotion } from "motion/react"
import { useEffect, useLayoutEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { api, CHANGED_EVENT } from "../lib/api"
import BrandMark from "./BrandMark"
import MainNav from "./MainNav"
import MobileNav from "./MobileNav"
import Starfield from "./Starfield"
import NotificationBell from "./NotificationBell"
import ThemeToggle from "./ThemeToggle"
import UserMenu from "./UserMenu"
import { resetStagger } from "./ui"
import { displayName, hasTeacherProfile, isAC, roleLabel } from "../lib/roles"

// Faculty and committee members see different navigation. `badge` names the
// live counter shown next to the link.
const links = [
  { to: "/professors", label: "Professors", committeeOnly: true },
  { to: "/courses", label: "Courses" },
  { to: "/observations", label: "Observations", badge: "requests" },
  { to: "/cycle", label: "Cycle", committeeOnly: true, badge: "alerts" },
  { to: "/notifications", label: "Notifications", profileOnly: true, badge: "unread" },
  { to: "/evaluation-criteria", label: "Evaluation Criteria", committeeOnly: true },
]

// Header and page content share one container, so their edges line up.
const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6"

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const committee = isAC(user)
  const [counts, setCounts] = useState({ requests: 0, alerts: 0, unread: 0 })

  // A new page gets a fresh list entrance. This runs before the page's own effects
  // record what they animated, so it never wipes them.
  useLayoutEffect(() => {
    resetStagger()
  }, [location.pathname])

  // Refresh the nav counters when the person moves to another page or changes data.
  useEffect(() => {
    let active = true
    async function refresh() {
      const next = { requests: 0, alerts: 0, unread: 0 }
      // Counters are a convenience and pages show their own errors, so one
      // failing call must not drop the other badges.
      const [alerts, incoming, inbox] = await Promise.allSettled([
        committee ? api.assessmentAlerts() : null,
        hasTeacherProfile(user) ? api.incomingRequests() : null,
        hasTeacherProfile(user) ? api.inbox() : null,
      ])
      // Insufficient pools: nobody eligible (urgent) plus short lists (limited).
      if (alerts.status === "fulfilled" && alerts.value) {
        next.alerts = alerts.value.counts.urgent + alerts.value.counts.limited
      }
      if (incoming.status === "fulfilled" && incoming.value) {
        next.requests = (incoming.value.data ?? []).filter(
          (request) => request.status === "pending",
        ).length
      }
      if (inbox.status === "fulfilled" && inbox.value) next.unread = inbox.value.unread
      if (active) setCounts(next)
    }
    refresh()
    window.addEventListener(CHANGED_EVENT, refresh)
    return () => {
      active = false
      window.removeEventListener(CHANGED_EVENT, refresh)
    }
  }, [location.pathname, committee, user])

  const signOut = () => {
    logout()
    navigate("/login", { replace: true })
  }

  // Same two filters as always: committee-only links and links that need a teacher profile.
  const visibleLinks = links
    .filter((link) => committee || !link.committeeOnly)
    .filter((link) => !link.profileOnly || hasTeacherProfile(user))

  const name = displayName(user)
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"

  return (
    <div className="min-h-screen font-sans text-ink">
      <Starfield variant="app" />
      <a
        href="#main-content"
        onClick={(event) => {
          // Move keyboard focus to the content without adding #main-content to the URL.
          event.preventDefault()
          document.getElementById("main-content")?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* One sticky row: logo, links (desktop), notifications, theme, account. The
          surface is translucent so the page shows through, but opaque enough that
          text stays readable (90% in dark, where a bright star under muted text
          would otherwise fall below 4.5:1). */}
      <header className="app-header sticky top-0 z-40 border-b border-line bg-surface/95 supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-md dark:supports-[backdrop-filter]:bg-surface/90">
        <div className={`${CONTAINER} flex h-16 items-center gap-3 sm:gap-6`}>
          <MobileNav
            items={visibleLinks}
            counts={counts}
            name={name}
            role={roleLabel(user)}
            onSignOut={signOut}
          />
          <BrandMark to="/" />
          <MainNav items={visibleLinks} counts={counts} />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu name={name} role={roleLabel(user)} initials={initials} onSignOut={signOut} />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className={`${CONTAINER} pt-8 pb-16 sm:pt-10`}>
        {/* Enter-only: the new page fades in and rises 6px. Nothing waits for an exit. */}
        <m.div
          key={location.pathname}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <Outlet />
        </m.div>
      </main>
    </div>
  )
}

export default Layout
