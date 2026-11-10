import { LoaderCircle, Lock } from "lucide-react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { EmptyState } from "./ui"

function ProtectedRoute({ children, roles }) {
  const { user, restoring } = useAuth()
  const location = useLocation()

  if (restoring) {
    return (
      <div role="status" className="grid min-h-[40vh] place-items-center">
        <LoaderCircle aria-label="Loading" className="h-6 w-6 animate-spin text-muted" />
      </div>
    )
  }

  if (!user) {
    // Logged-out visitors to the bare site address see the public landing page;
    // deep links to protected pages still go to the sign-in page.
    if (location.pathname === "/") return <Navigate to="/welcome" replace />
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={Lock}
        titleAs="h1"
        title="This page is limited to the Assessment Committee"
        text="Your account doesn't have access to it. Use the navigation to go back to your pages."
      />
    )
  }

  return children
}

export default ProtectedRoute
