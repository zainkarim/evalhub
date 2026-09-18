import { Link, useParams } from "react-router-dom"


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
  <div className="min-h-screen bg-[#f5f7f6] px-5 py-[60px] font-[Arial]">
    <div className="mx-auto max-w-[700px] rounded-xl bg-white p-[35px] shadow-lg">
      <h1 className="mt-0 mb-2 text-[30px] font-normal text-[#154734]">
        Professor Details
      </h1>

      <p className="mb-7 text-gray-600">
        View professor information.
      </p>

      <div className="mb-5">
        <p className="mb-1 font-semibold">Name</p>
        <p className="rounded-md border border-gray-300 px-4 py-3">
          {professor.firstName} {professor.lastName}
        </p>
      </div>

      <div className="mb-5">
        <p className="mb-1 font-semibold">Email</p>
        <p className="rounded-md border border-gray-300 px-4 py-3">
          {professor.email}
        </p>
      </div>

      <div className="mb-5">
        <p className="mb-1 font-semibold">School</p>
        <p className="rounded-md border border-gray-300 px-4 py-3">
          {professor.school}
        </p>
      </div>

      <div className="mb-5">
        <p className="mb-1 font-semibold">Rank</p>
        <p className="rounded-md border border-gray-300 px-4 py-3">
          {professor.rank}
        </p>
      </div>

      <div className="mb-7">
        <p className="mb-1 font-semibold">Status</p>
        <p className="rounded-md border border-gray-300 px-4 py-3">
          {professor.active ? "Active" : "Inactive"}
        </p>
      </div>

      <Link
        to="/"
        className="inline-block rounded-md bg-[#154734] px-5 py-3 font-semibold text-white hover:bg-[#0f3527]"
      >
        Back to Professor List
      </Link>
    </div>
  </div>
)
}

export default ProfessorDetail