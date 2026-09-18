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
  <div className="min-h-screen bg-[#f5f7f6] px-5 py-[60px] font-[Arial]">
    <div className="mx-auto max-w-[800px] rounded-xl bg-white p-[35px] shadow-lg">
      
      <h1 className="mt-0 mb-6 text-[30px] font-normal text-[#154734]">
        Professor List
      </h1>

      {/* Search and filter */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Search professor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-base"
        />

        <select
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-3 text-base"
        >
          <option value="All">All Ranks</option>
          <option value="Assistant Professor">Assistant Professor</option>
          <option value="Associate Professor">Associate Professor</option>
          <option value="Full Professor">Full Professor</option>
        </select>
      </div>

      {/* gyosoo table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#f5f7f6]">
            <th className="border-b-2 border-gray-300 p-3 text-left">
              Name
            </th>
            <th className="border-b-2 border-gray-300 p-3 text-left">
              Rank
            </th>
            <th className="border-b-2 border-gray-300 p-3 text-left">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {filteredProfessors.map((professor) => (
            <tr key={professor.id}>
              <td className="border-b border-gray-200 p-3">
                <Link
                  to={`/professors/${professor.id}`}
                  className="font-semibold text-[#154734] hover:underline"
                >
                  {professor.firstName} {professor.lastName}
                </Link>
              </td>

              <td className="border-b border-gray-200 p-3">
                {professor.rank}
              </td>

              <td className="border-b border-gray-200 p-3">
                {professor.active ? "Active" : "Inactive"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredProfessors.length === 0 && (
        <p className="mt-4">No professors found.</p>
      )}
    </div>
  </div>
)
}

export default Professors