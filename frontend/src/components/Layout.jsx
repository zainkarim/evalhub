import { useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { api, CHANGED_EVENT } from "../lib/api"
import NotificationBell from "./NotificationBell"
import { displayName, hasTeacherProfile, isAC, roleLabel } from "../lib/roles"

// Faculty and committee members see different navigation. `badge` names the
// live counter shown next to the link.
const links = [
  { to: "/professors", label: "Professors", committeeOnly: true },
  { to: "/courses", label: "Courses" },
  { to: "/observations", label: "Observations", badge: "requests" },
  { to: "/review", label: "Sign-up review", committeeOnly: true, badge: "alerts" },
  { to: "/evaluation-criteria", label: "Evaluation Criteria", committeeOnly: true },
]

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const committee = isAC(user)
  const [counts, setCounts] = useState({ requests: 0, alerts: 0 })

  // Refresh the nav counters when the person moves to another page or changes data.
  useEffect(() => {
    let active = true
    async function refresh() {
      const next = { requests: 0, alerts: 0 }
      try {
        if (committee) {
          // Insufficient pools: nobody eligible (urgent) plus short lists (limited).
          const alerts = await api.assessmentAlerts()
          next.alerts = alerts.counts.urgent + alerts.counts.limited
        }
        if (hasTeacherProfile(user)) {
          const incoming = await api.incomingRequests()
          next.requests = (incoming.data ?? []).filter(
            (request) => request.status === "pending",
          ).length
        }
      } catch {
        // counters are a convenience; pages show their own errors
      }
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

  const name = displayName(user)
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <header>
        {/* Brand bar: who you are and what app this is. */}
        <div className="brand-bar bg-utd-green-dark text-white">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-6">
            <Link to="/" className="flex shrink-0 items-center gap-3 rounded-md">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-bold text-utd-green-dark shadow-sm"
              >
                E
              </span>
              <span className="leading-tight">
                <span className="block text-lg font-semibold tracking-tight">EvalHub</span>
                <span className="hidden text-xs text-white/70 sm:block">
                  Faculty peer observation · UT Dallas ECS
                </span>
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-2 text-sm sm:gap-4">
              <NotificationBell />
              <span aria-hidden="true" className="hidden h-8 w-px bg-white/20 sm:block" />
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-semibold ring-1 ring-white/25"
                >
                  {initials}
                </span>
                <span className="hidden leading-tight md:block">
                  <span className="block font-medium">{name}</span>
                  {roleLabel(user) && (
                    <span className="block text-xs text-white/70">{roleLabel(user)}</span>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={signOut}
                className="ml-1 rounded-md border border-white/30 px-3.5 py-1.5 font-medium text-white/90 hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Navigation row: where you can go. */}
        <div className="border-b border-line bg-white">
          <nav
            aria-label="Main"
            className="mx-auto flex h-12 w-full max-w-7xl gap-2 overflow-x-auto px-4 text-sm [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
          >
            {links
              .filter((link) => committee || !link.committeeOnly)
              .map((link) => {
                const count =
                  link.badge === "requests"
                    ? counts.requests
                    : link.badge === "alerts"
                      ? counts.alerts
                      : 0
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `relative flex h-full shrink-0 items-center gap-2 whitespace-nowrap px-3 ${
                        isActive
                          ? "font-semibold text-utd-green-dark after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-utd-green"
                          : "text-muted hover:text-ink"
                      }`
                    }
                  >
                    {link.label}
                    {count > 0 && (
                      <span
                        className="min-w-[1.25rem] rounded-full bg-utd-orange px-1.5 text-center text-[11px] font-semibold leading-5 text-white"
                        aria-label={`${count} waiting`}
                      >
                        {count}
                      </span>
                    )}
                  </NavLink>
                )
              })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pt-10 pb-16">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
