import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import { useAuth } from "./context/auth-context"
import { AC_ROLES, isAC } from "./lib/roles"
import Approvals from "./pages/Approvals"
import AssessmentDetail from "./pages/AssessmentDetail"
import CourseDetail from "./pages/CourseDetail"
import Courses from "./pages/Courses"
import Login from "./pages/Login"
import ObservationRecord from "./pages/ObservationRecord"
import ObservationSignup from "./pages/ObservationSignup"
import Observations from "./pages/Observations"
import ProfessorDetail from "./pages/ProfessorDetail"
import Professors from "./pages/Professors"

// Committee-only pages: anyone else gets a plain "limited to the committee"
// message instead of the page (the navigation link is hidden for them too).
function CommitteeRoute({ children }) {
  return <ProtectedRoute roles={AC_ROLES}>{children}</ProtectedRoute>
}

// Each role lands on the page it works from.
function Home() {
  const { user } = useAuth()
  return <Navigate to={isAC(user) ? "/approvals" : "/observations"} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

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
              path="/approvals"
              element={
                <CommitteeRoute>
                  <Approvals />
                </CommitteeRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
