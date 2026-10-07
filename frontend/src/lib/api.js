import { mockRequest } from "./mockServer"

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")

// No backend URL configured -> serve the same shapes from the in-browser mock
// (lib/mockServer.js) so the whole UI runs without the API. Set VITE_API_URL in
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

// Fired after every successful write so shared UI (the nav counters) can refresh.
export const CHANGED_EVENT = "evalhub:changed"

async function request(path, options = {}) {
  const result = await send(path, options)
  if ((options.method ?? "GET") !== "GET") window.dispatchEvent(new Event(CHANGED_EVENT))
  return result
}

async function send(path, { method = "GET", body, auth = true } = {}) {
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

  const data =
    response.status === 204 ? null : await response.json().catch(() => null)

  // The backend answers { error: { code, message } }.
  const serverMessage = data?.error?.message ?? data?.message

  // A 401 on an authenticated call means the token expired. On the login call
  // it just means the credentials were wrong, so keep the server's message.
  if (response.status === 401 && auth) {
    clearToken()
    throw new ApiError("Your session ended. Sign in again.", 401)
  }

  if (!response.ok) {
    throw new ApiError(
      serverMessage ?? `Request failed (${response.status}).`,
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

const post = (path, body) => request(path, { method: "POST", body })

export const api = {
  // ---- auth
  // POST /auth/login -> { token, user }
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),

  // GET /auth/me -> user
  me: () => request("/auth/me"),

  // ---- catalogue (page size is capped at 100 by the backend)
  listProfessors: (params) => request(`/teachers${query({ pageSize: 100, ...params })}`),
  getProfessor: (id) => request(`/teachers/${id}`),

  listCourses: (params) => request(`/courses${query({ pageSize: 100, ...params })}`),
  getCourse: (id) => request(`/courses/${id}`),

  listSections: (params) => request(`/sections${query(params)}`),
  listTerms: (params) => request(`/terms${query(params)}`),

  // ---- sign-ups ("assessments")
  signUp: (sectionId, teacherId) =>
    post("/assessments/sign-up", teacherId ? { sectionId, teacherId } : { sectionId }),
  myAssessments: () => request("/assessments/mine"),
  listAssessments: (params) =>
    request(`/assessments${query({ pageSize: 100, ...params })}`),
  getAssessment: (id) => request(`/assessments/${id}`),

  // ---- committee: start observer selection (after the sign-up deadline)
  generateCandidates: (id) => post(`/assessments/${id}/candidates`),
  startSelection: (body) => post("/assessments/start-selection", body),
  assessmentAlerts: (params) => request(`/assessments/alerts${query(params)}`),
  stepInOptions: (id) => request(`/assessments/${id}/step-in-options`),
  assignObserver: (id, body) => post(`/assessments/${id}/observations`, body),
  postponeAssessment: (id, reason) => post(`/assessments/${id}/postpone`, { reason }),

  // ---- professor: one observer, 4-8 dates, one request
  addTimeOptions: (id, options) => post(`/assessments/${id}/time-options`, { options }),
  sendRequest: (id, teacherId) => post(`/assessments/${id}/time-options/send`, { teacherId }),
  withdrawRequest: (id, reason) =>
    post(`/assessments/${id}/time-options/withdraw`, reason ? { reason } : {}),

  // ---- observer: confirm one date, or decline
  incomingRequests: () => request("/time-options/incoming"),
  confirmTimeOption: (optionId) => post(`/time-options/${optionId}/confirm`),
  declineRequest: (id, reason) =>
    post(`/assessments/${id}/time-options/decline`, reason ? { reason } : {}),

  // ---- observations (given / received) and their confirmation
  listObservations: (params) => request(`/observations${query(params)}`),
  getObservation: (id) => request(`/observations/${id}`),
  signOffObservation: (id, comment) =>
    post(`/observations/${id}/sign-off`, comment ? { comment } : {}),
  postponeObservation: (id, reason) => post(`/observations/${id}/postpone`, { reason }),
}

export { USE_MOCKS }
