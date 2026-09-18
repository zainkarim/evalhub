import { BrowserRouter, Routes, Route } from "react-router-dom"
import Professors from "./pages/Professors"
import ProfessorDetail from "./pages/ProfessorDetail"


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Professors />} />
        <Route path="/professors/:id" element={<ProfessorDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App