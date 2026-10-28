import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import { useAuth } from "./context/auth-context"
import { AC_ROLES, isAC } from "./lib/roles"
import { ScreenFallback } from "./components/RouteFallback"

// Every page is its own chunk, downloaded when the route is first visited (the
// app shell and the route guards stay in the main bundle). Route paths and
// guards are exactly as before.
const AssessmentDetail = lazy(() => import("./pages/AssessmentDetail"))
const CourseDetail = lazy(() => import("./pages/CourseDetail"))
const Courses = lazy(() => import("./pages/Courses"))
const Cycle = lazy(() => import("./pages/Cycle"))
const EvaluationCriteria = lazy(() => import("./pages/EvaluationCriteria"))
const Landing = lazy(() => import("./pages/Landing"))
const Login = lazy(() => import("./pages/Login"))
const Notifications = lazy(() => import("./pages/Notifications"))
const ObservationRecord = lazy(() => import("./pages/ObservationRecord"))
const ObservationSignup = lazy(() => import("./pages/ObservationSignup"))
const Observations = lazy(() => import("./pages/Observations"))
const ProfessorDetail = lazy(() => import("./pages/ProfessorDetail"))
const ProfessorManagement = lazy(() => import("./pages/ProfessorManagement"))
const Professors = lazy(() => import("./pages/Professors"))

// Committee-only pages: anyone else gets a plain "limited to the committee"
// message instead of the page (the navigation link is hidden for them too).
function CommitteeRoute({ children }) {
  return <ProtectedRoute roles={AC_ROLES}>{children}</ProtectedRoute>
}

// Each role lands on the page it works from: the committee on the Cycle page.
function Home() {
  const { user } = useAuth()
  return <Navigate to={isAC(user) ? "/cycle" : "/observations"} replace />
}

// Dev-only UI kit gallery. The guard makes the import dead code in a production
// build, so the page never ships.
const UiGallery = import.meta.env.DEV ? lazy(() => import("./pages/dev/UiGallery")) : null

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<ScreenFallback />}>
        <Routes>
          <Route path="/welcome" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          {import.meta.env.DEV && (
            <Route
              path="/dev/ui"
              element={
                <Suspense fallback={null}>
                  <UiGallery />
                </Suspense>
              }
            />
          )}

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route
              path="/professors"
              element={
                <CommitteeRoute>
                  <Professors />
                </CommitteeRoute>
              }
            />
            <Route
              path="/professors/new"
              element={
                <CommitteeRoute>
                  <ProfessorManagement />
                </CommitteeRoute>
              }
            />

            <Route
              path="/professors/:id/edit"
              element={
                <CommitteeRoute>
                  <ProfessorManagement />
                </CommitteeRoute>
              }
            />

            <Route
              path="/professors/:id"
              element={
                <CommitteeRoute>
                  <ProfessorDetail />
                </CommitteeRoute>
              }
            />

            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/observations" element={<Observations />} />
            <Route path="/observation-signup" element={<ObservationSignup />} />
            <Route path="/assessments/:id" element={<AssessmentDetail />} />
            <Route path="/records/:id" element={<ObservationRecord />} />
            <Route
              path="/cycle"
              element={
                <CommitteeRoute>
                  <Cycle />
                </CommitteeRoute>
              }
            />
<Route path="/review" element={<Navigate to="/cycle" replace />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route
              path="/evaluation-criteria"
              element={
                <CommitteeRoute>
                  <EvaluationCriteria />
                </CommitteeRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App