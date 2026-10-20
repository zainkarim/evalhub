import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { api, CHANGED_EVENT } from "../lib/api"
import { displayName, hasTeacherProfile, isAC, roleLabel } from "../lib/roles"

// Faculty and committee members see different navigation. `badge` names the
// live counter shown next to the link.
const links = [
  { to: "/professors", label: "Professors", committeeOnly: true },
  { to: "/courses", label: "Courses" },
  { to: "/observations", label: "Observations", badge: "requests" },
  { to: "/cycle", label: "Cycle", committeeOnly: true, badge: "alerts" },
  { to: "/notifications", label: "Notifications", profileOnly: true, badge: "unread" },
]

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const committee = isAC(user)
  const [counts, setCounts] = useState({ requests: 0, alerts: 0, unread: 0 })

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

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">
            EvalHub
            <span className="ml-2 align-middle text-xs font-normal text-muted">
              UT Dallas ECS
            </span>
          </span>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links
              .filter((link) => committee || !link.committeeOnly)
              .filter((link) => !link.profileOnly || hasTeacherProfile(user))
              .map((link) => {
                const count = counts[link.badge] ?? 0
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `border-b-2 pb-1 ${
                        isActive
                          ? "border-utd-green text-ink"
                          : "border-transparent text-muted hover:text-ink"
                      }`
                    }
                  >
                    {link.label}
                    {count > 0 && (
                      <span
                        className="ml-1.5 rounded-full bg-utd-orange px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        aria-label={`${count} waiting`}
                      >
                        {count}
                      </span>
                    )}
                  </NavLink>
                )
              })}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted">
              {displayName(user)}
              {roleLabel(user) ? ` · ${roleLabel(user)}` : ""}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="rounded border border-line px-3 py-1.5 hover:border-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
