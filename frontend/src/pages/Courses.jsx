import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"

const terms = ["Fall 2026", "Spring 2026", "Fall 2025"]

function Courses() {
  const [term, setTerm] = useState("")
  const [search, setSearch] = useState("")
  const [committedSearch, setCommittedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setCommittedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const call = useCallback(
    () => api.listCourses({ term, search: committedSearch }),
    [term, committedSearch],
  )
  const { data: courses, error, loading, reload } = useApi(call)

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
      <p className="mt-1 text-sm text-muted">
        Course sections available for observation sign-up.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by course number, title, or instructor"
          aria-label="Search courses"
          className="w-full max-w-sm rounded border border-line bg-white px-3 py-2 text-sm"
        />
        <select
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label="Filter by term"
          className="rounded border border-line bg-white px-3 py-2 text-sm"
        >
          <option value="">All terms</option>
          {terms.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <StateBlock
          loading={loading}
          error={error}
          onRetry={reload}
          empty={courses?.length === 0}
          emptyMessage="No courses match these filters. Clear the search or pick another term."
        >
          <div className="overflow-x-auto rounded border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Instructor</th>
                  <th className="px-4 py-3 font-medium">Meets</th>
                </tr>
              </thead>
              <tbody>
                {courses?.map((course) => (
                  <tr key={course.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={`/courses/${course.id}`}
                        className="font-medium text-utd-green hover:underline"
                      >
                        {course.courseNumber}
                      </Link>
                      <span className="block text-muted">{course.title}</span>
                    </td>
                    <td className="px-4 py-3">{course.term}</td>
                    <td className="px-4 py-3">{course.section}</td>
                    <td className="px-4 py-3">{course.instructor?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {course.schedule
                        ? `${course.schedule.days} ${course.schedule.startTime}–${course.schedule.endTime}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBlock>
      </div>
    </div>
  )
}

export default Courses
