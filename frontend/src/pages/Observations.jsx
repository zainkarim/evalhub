import { Link } from "react-router-dom"
import { useAuth } from "../context/auth-context"

function Observations() {
  const { user } = useAuth()

  const requests = JSON.parse(
    localStorage.getItem("observationRequests") || "[]"
  )

  const isAC =
    user?.role === "ac_member" || user?.role === "admin"

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAC ? "Observation Requests" : "My Observations"}
          </h1>

          <p className="mt-1 text-sm text-muted">
            {isAC
              ? "View faculty observation requests and their current status."
              : "View your observation requests and their current status."}
          </p>
        </div>

        {!isAC && (
          <Link
            to="/observation-signup"
            className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Request Observation
          </Link>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded border border-line bg-white">
        {requests.length === 0 ? (
          <div className="p-6 text-sm text-muted">
            {isAC
              ? "There are no observation requests yet."
              : "You have not requested any observations yet."}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                {isAC && (
                  <th className="px-4 py-3 font-medium">Faculty</th>
                )}
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="border-b border-line last:border-0"
                >
                  {isAC && (
                    <td className="px-4 py-3">
                      {request.facultyName || "Faculty"}
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <span className="font-medium text-utd-green">
                      {request.courseNumber}
                    </span>
                    <span className="block text-muted">
                      {request.title}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {request.semester}
                  </td>

                  <td className="px-4 py-3">
                    {request.section}
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium">
                      {request.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Observations