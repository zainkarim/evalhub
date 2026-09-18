import { Link } from "react-router-dom"

function Professors() {
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

  return (
    <div>
      <h1>Professor List</h1>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Rank</th>
          </tr>
        </thead>

        <tbody>
          {professors.map((professor) => (
            <tr key={professor.id}>
              <td>
                <Link to={`/professors/${professor.id}`}>
                {professor.firstName} {professor.lastName}
                </Link>
              </td>
              <td>{professor.rank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Professors