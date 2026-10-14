import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/auth-context"

function ProtectedRoute({ children, roles }) {
  const { user, restoring } = useAuth()
  const location = useLocation()

  if (restoring) {
    return <p className="p-10 text-sm text-muted">Loading…</p>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <p className="p-10 text-sm text-muted">
        This page is limited to the Assessment Committee.
      </p>
    )
  }

  return children
}

export default ProtectedRoute
