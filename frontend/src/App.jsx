import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import { useAuth } from "./context/auth-context"
import CourseDetail from "./pages/CourseDetail"
import ObservationSignup from "./pages/ObservationSignup"
import Observations from "./pages/Observations"
import Courses from "./pages/Courses"
import Login from "./pages/Login"
import ProfessorDetail from "./pages/ProfessorDetail"
import ProfessorManagement from "./pages/ProfessorManagement"
import Professors from "./pages/Professors"

function ACOnlyRoute({ children }) {
  const { user } = useAuth()

  if (user?.role !== "ac_member" && user?.role !== "admin") {
    return <Navigate to="/courses" replace />
  }

  return children
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
            <Route path="/" element={<Navigate to="/courses" replace />} />

            <Route
              path="/professors"
              element={
                <ACOnlyRoute>
                  <Professors />
                </ACOnlyRoute>
              }
            />

            <Route
              path="/professors/new"
              element={
                <ACOnlyRoute>
                  <ProfessorManagement />
                </ACOnlyRoute>
              }
            />

            <Route
              path="/professors/:id/edit"
              element={
                <ACOnlyRoute>
                  <ProfessorManagement />
                </ACOnlyRoute>
              }
            />

            <Route
              path="/professors/:id"
              element={
                <ACOnlyRoute>
                  <ProfessorDetail />
                </ACOnlyRoute>
              }
            />

            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/observations" element={<Observations />} />
            <Route path="/observation-signup" element={<ObservationSignup />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App