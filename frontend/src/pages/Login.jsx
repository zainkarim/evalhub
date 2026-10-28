import { ArrowLeft, Eye, EyeOff, LoaderCircle } from "lucide-react"
import { Suspense, lazy, useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import BrandMark from "../components/BrandMark"
import Starfield from "../components/Starfield"
import ThemeToggle from "../components/ThemeToggle"
import { Button, Card, Input, Label } from "../components/ui"
import { useAuth } from "../context/auth-context"

// Developer quick login: development or demo (mock) mode only. The condition is
// written out here so a build for the real backend (VITE_API_URL set) drops the
// import entirely and ships no demo accounts, password or quick-login code.
const DevQuickLogin =
  import.meta.env.DEV || !import.meta.env.VITE_API_URL
    ? lazy(() => import("../components/dev/DevQuickLogin"))
    : null

function Login() {
  const { user, restoring, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (restoring) {
    return (
      <div role="status" className="grid min-h-screen place-items-center">
        <LoaderCircle aria-label="Loading" className="h-6 w-6 animate-spin text-muted" />
      </div>
    )
  }
  if (user) return <Navigate to={location.state?.from ?? "/"} replace />

  // The one sign-in path: the form and the developer quick login both use it.
  const signIn = async (emailAddress, secret) => {
    await login(emailAddress, secret)
    navigate(location.state?.from ?? "/", { replace: true })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div data-page="login" className="relative min-h-screen font-sans text-ink">
      <Starfield variant="hero" />

      {/* The top bar floats over the page, so the card below is centred in the whole window
          (main keeps room for the bar above and the same room below). */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="sky-scrim">
          <Link
            to="/welcome"
            aria-label="Back to the EvalHub welcome page"
            className="flex items-center gap-2 rounded-md text-muted hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            <BrandMark />
          </Link>
        </div>
        <ThemeToggle className="bg-surface ring-1 ring-line" />
      </header>

      <main id="main-content" className="flex min-h-screen flex-col items-center justify-center px-4 py-[5.5rem]">
        <div className="relative w-full max-w-sm">
          <Card className="p-8 shadow-lg">
            <BrandMark size={44} variant="medium" className="mb-6" />
            <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted">Use your UTD email address.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5"
                  placeholder="name@utdallas.edu"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <Button type="submit" fullWidth loading={submitting}>
                Sign in
              </Button>
            </form>
          </Card>

          {/* Under the card but outside the centring, so the card itself is what sits in the middle. */}
          <div className="absolute inset-x-0 top-full mt-6 flex justify-center">
            <div className="sky-scrim">
              <p className="text-sm text-muted">Faculty peer observation · UT Dallas ECS</p>
            </div>
          </div>
        </div>
      </main>

      {DevQuickLogin && (
        <Suspense fallback={null}>
          <DevQuickLogin onSignIn={signIn} onReset={() => setError(null)} />
        </Suspense>
      )}
    </div>
  )
}

export default Login
