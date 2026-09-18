import { useState } from "react"
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

  const [search, setSearch] = useState("")
  const [rank, setRank] = useState("All")

  // 이름과 rank로 교수 목록 필터링
  const filteredProfessors = professors.filter((professor) => {
    const name = `${professor.firstName} ${professor.lastName}`.toLowerCase()

    return (
      name.includes(search.toLowerCase()) &&
      (rank === "All" || professor.rank === rank)
    )
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-5">Professor List</h1>

      {/* 검색 및 rank 선택 */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search professor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 mr-2"
        />

        <select
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          className="border px-3 py-2"
        >
          <option value="All">All Ranks</option>
          <option value="Assistant Professor">Assistant Professor</option>
          <option value="Associate Professor">Associate Professor</option>
          <option value="Full Professor">Full Professor</option>
        </select>
      </div>

      {/* 교수 목록 */}
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Rank</th>
            <th className="border px-4 py-2 text-left">Status</th>
          </tr>
        </thead>

        <tbody>
          {filteredProfessors.map((professor) => (
            <tr key={professor.id}>
              <td className="border px-4 py-2">
                <Link
                  to={`/professors/${professor.id}`}
                  className="text-blue-600 underline"
                >
                  {professor.firstName} {professor.lastName}
                </Link>
              </td>

              <td className="border px-4 py-2">{professor.rank}</td>

              <td className="border px-4 py-2">
                {professor.active ? "Active" : "Inactive"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredProfessors.length === 0 && (
        <p className="mt-3">No professors found.</p>
      )}
    </div>
  )
}

export default Professors