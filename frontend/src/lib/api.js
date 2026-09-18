import { mockRequest } from "./mockData"

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")

// No backend URL configured -> serve the same shapes from mockData so the UI
// stays buildable while the API is still in progress. Set VITE_API_URL in
// .env.local to talk to the real server.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true" || BASE_URL === ""

const TOKEN_KEY = "evalhub.token"

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  if (USE_MOCKS) return mockRequest(path, { method, body, token: getToken() })

  const headers = { "Content-Type": "application/json" }
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError("Can't reach the server. Check that the API is running.")
  }

  if (response.status === 401) {
    clearToken()
    throw new ApiError("Your session ended. Sign in again.", 401)
  }

  const data =
    response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      data?.message ?? `Request failed (${response.status}).`,
      response.status,
    )
  }
  return data
}

function query(params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  )
  if (entries.length === 0) return ""
  return `?${new URLSearchParams(entries)}`
}

export const api = {
  // POST /auth/login -> { token, user }
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),

  // GET /auth/me -> user
  me: () => request("/auth/me"),

  listProfessors: (params) => request(`/professors${query(params)}`),
  getProfessor: (id) => request(`/professors/${id}`),

  listCourses: (params) => request(`/courses${query(params)}`),
  getCourse: (id) => request(`/courses/${id}`),
}

export { USE_MOCKS }
