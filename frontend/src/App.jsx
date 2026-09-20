import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import { AuthProvider } from "./context/AuthContext"
import CourseDetail from "./pages/CourseDetail"
import ObservationSignup from "./pages/ObservationSignup"
import Courses from "./pages/Courses"
import Login from "./pages/Login"
import ProfessorDetail from "./pages/ProfessorDetail"
import Professors from "./pages/Professors"

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
            <Route path="/professors" element={<Professors />} />
            <Route path="/professors/:id" element={<ProfessorDetail />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/observation-signup" element={<ObservationSignup />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
