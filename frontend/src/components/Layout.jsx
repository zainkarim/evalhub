import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"

const links = [
  { to: "/professors", label: "Professors" },
  { to: "/courses", label: "Courses" },
]

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
            {links.map((link) => (
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
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-muted">
              {user?.name}
              {user?.role === "AC" ? " · Assessment Committee" : ""}
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
