import { useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { USE_MOCKS } from "../lib/api"
import { resetMockData } from "../lib/mockServer"

function Login() {
  const { user, restoring, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (restoring) return <p className="p-10 text-sm text-muted">Loading…</p>
  if (user) return <Navigate to={location.state?.from ?? "/"} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(location.state?.from ?? "/", { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink md:grid md:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col justify-between bg-utd-green-dark px-8 py-10 text-white md:px-12 md:py-12">
        <p className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-base font-bold text-utd-green-dark"
          >
            E
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight">EvalHub</span>
            <span className="block text-xs text-white/70">UT Dallas ECS</span>
          </span>
        </p>
        <div className="my-14 max-w-sm">
          <h1 className="text-3xl leading-[1.15] font-semibold md:text-[2.5rem]">
            Peer teaching evaluations for ECS faculty.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/80">
            Sign in to see who is due for evaluation, review observer lists
            before they go out, and keep a record of every observation given and
            received.
          </p>
        </div>
        <p className="text-xs text-white/70">
          Erik Jonsson School of Engineering &amp; Computer Science
        </p>
      </section>

      <section className="flex items-center px-8 py-12 md:px-16">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your UTD email address.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                placeholder="name@utdallas.edu"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-utd-orange/40 bg-white px-3 py-2 text-sm"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-utd-green px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-utd-green-dark disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 rounded-lg border border-line bg-white p-4 shadow-xs">
            <p className="text-sm font-semibold">Demo accounts</p>
            <p className="mt-0.5 text-xs text-muted">
              For development and team testing only. Click one to fill in the form.
            </p>

            <div className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line">
              {[
                { label: "Faculty", email: "faculty@example.edu", note: "Professor C — signs up, then picks one observer and dates" },
                { label: "Assessment Committee", email: "ac@example.edu", note: "Professor B — sign-up review, starts observer selection" },
                { label: "Administrator", email: "admin@example.edu", note: "Committee view, no teaching profile" },
                ...(USE_MOCKS
                  ? [
                      { label: "Faculty (observer)", email: "professor.h@example.edu", note: "Professor H — confirms one of the offered dates" },
                      { label: "Faculty (5+ candidates)", email: "professor.e@example.edu", note: "Professor E — CS 3354 has 6 eligible observers" },
                    ]
                  : []),
              ].map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword("ChangeMe-Dev-123!")
                  }}
                  className="block w-full px-3 py-2.5 text-left text-sm hover:bg-canvas"
                >
                  <span className="font-medium">{account.label}</span>
                  <span className="block text-xs text-muted">
                    {account.email} · {account.note}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted">
              Password: ChangeMe-Dev-123!
            </p>

            {USE_MOCKS && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                Running on built-in sample data (no backend needed). Changes are kept in
                this browser.{" "}
                <button
                  type="button"
                  onClick={() => {
                    resetMockData()
                    setError(null)
                  }}
                  className="font-medium text-utd-green hover:underline"
                >
                  Reset demo data
                </button>
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Login
