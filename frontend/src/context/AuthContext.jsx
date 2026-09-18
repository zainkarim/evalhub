import { useCallback, useEffect, useState } from "react"
import { api, clearToken, getToken, setToken } from "../lib/api"
import { AuthContext } from "./auth-context"

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [restoring, setRestoring] = useState(() => Boolean(getToken()))

  // Restore the session on refresh: the token lives in localStorage, the
  // profile always comes back from the server.
  useEffect(() => {
    if (!getToken()) return
    api
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setRestoring(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const { token, user: profile } = await api.login(email, password)
    setToken(token)
    setUser(profile)
    return profile
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext value={{ user, restoring, login, logout }}>
      {children}
    </AuthContext>
  )
}
