import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import { displayName, hasTeacherProfile, isAC, roleLabel } from "../lib/roles"

// Faculty and committee members see different navigation. `badge` names the
// live counter shown next to the link.
const links = [
  { to: "/professors", label: "Professors", committeeOnly: true },
  { to: "/courses", label: "Courses" },
  { to: "/observations", label: "Observations", badge: "requests" },
  { to: "/approvals", label: "Approvals", committeeOnly: true, badge: "approvals" },
]

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const committee = isAC(user)
  const [counts, setCounts] = useState({ requests: 0, approvals: 0 })

  // Refresh the nav counters whenever the person moves to another page.
  useEffect(() => {
    let active = true
    async function refresh() {
      const next = { requests: 0, approvals: 0 }
      try {
        if (committee) {
          const queue = await api.assessmentQueue()
          next.approvals = queue.counts.pendingApproval + queue.counts.needsAttention
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
    return () => {
      active = false
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

          <nav className="flex gap-6 text-sm">
            {links
              .filter((link) => committee || !link.committeeOnly)
              .map((link) => {
                const count =
                  link.badge === "requests"
                    ? counts.requests
                    : link.badge === "approvals"
                      ? counts.approvals
                      : 0
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

          <div className="ml-auto flex items-center gap-4 text-sm">
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
