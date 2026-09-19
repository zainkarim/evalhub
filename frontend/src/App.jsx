import { BrowserRouter, Routes, Route } from "react-router-dom"
import Professors from "./pages/Professors"
import ProfessorDetail from "./pages/ProfessorDetail"
import ObservationSignup from "./pages/ObservationSignup"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Professors />} />
        <Route path="/professors/:id" element={<ProfessorDetail />} />
        <Route path="/observation-signup" element={<ObservationSignup />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App