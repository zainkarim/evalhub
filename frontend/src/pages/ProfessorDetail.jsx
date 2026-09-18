import { useParams } from "react-router-dom"


function ProfessorDetail() {
  const { id } = useParams()

  const professors = [
    {
      id: 1,
      firstName: "Professor",
      lastName: "A",
      email: "professorA@utdallas.edu",
      school: "ECS",
      rank: "Assistant Professor",
      active: true,
    },
    {
      id: 2,
      firstName: "Professor",
      lastName: "B",
      email: "professorB@utdallas.edu",
      school: "ECS",
      rank: "Associate Professor",
      active: true,
    },
    {
      id: 3,
      firstName: "Professor",
      lastName: "C",
      email: "professorC@utdallas.edu",
      school: "ECS",
      rank: "Full Professor",
      active: true,
    },
  ]

  const professor = professors.find(
    (professor) => professor.id === Number(id)
  )

  if (!professor) {
    return <p>Professor not found.</p>
  }

  return (
    <div>
      <h1>Professor Details</h1>

      <p>Name: {professor.firstName} {professor.lastName}</p>
      <p>Email: {professor.email}</p>
      <p>School: {professor.school}</p>
      <p>Rank: {professor.rank}</p>
      <p>Status: {professor.active ? "Active" : "Inactive"}</p>
    </div>
  )
}

export default ProfessorDetail