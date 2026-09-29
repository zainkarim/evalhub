import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useAuth } from "../context/auth-context"

const terms = ["Fall 2026", "Spring 2026", "Fall 2025"]

function Courses() {
  const { user } = useAuth()
  const [term, setTerm] = useState("")
  const [search, setSearch] = useState("")
  const [committedSearch, setCommittedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setCommittedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

 const call = useCallback(async () => {
  const canViewTeachers =
    user?.role === "ac_member" || user?.role === "admin"

  const [
    coursesResponse,
    sectionsResponse,
    termsResponse,
    professorsResponse,
  ] = await Promise.all([
    api.listCourses({}),
    api.listSections(
      user?.role === "faculty" && user?.teacherId
        ? { teacherId: user.teacherId }
        : {}
    ),
    api.listTerms({}),
    canViewTeachers
      ? api.listProfessors({})
      : Promise.resolve({ data: [] }),
  ])

  const courses = coursesResponse.data ?? []
  const sections = sectionsResponse.data ?? []
  const termData = termsResponse.data ?? []
  const professors = professorsResponse.data ?? []

  return sections.map((section) => {
    const course = courses.find(
      (item) => item.id === section.courseId
    )

    const courseTerm = termData.find(
      (item) => item.id === section.termId
    )

    const professor = professors.find(
      (item) => item.id === section.teacherId
    )

    const instructorName =
      user?.role === "faculty"
        ? [user.firstName, user.lastName]
            .filter(Boolean)
            .join(" ") || user.email
        : professor
          ? `${professor.firstName} ${professor.lastName}`
          : null

    return {
      id: section.id,
      courseId: section.courseId,

      courseNumber: course
        ? `${course.subject} ${course.courseNumber}`
        : "Unknown Course",

      title: course?.title ?? "",

      term: courseTerm
        ? `${courseTerm.season.charAt(0).toUpperCase() + courseTerm.season.slice(1)} ${courseTerm.year}`
        : "Unknown Term",

      section: section.sectionNumber,

      instructor: instructorName
        ? {
            id: section.teacherId,
            name: instructorName,
          }
        : null,

      schedule: section.meetingDays
        ? {
            days: section.meetingDays,
            startTime: section.startTime ?? "",
            endTime: section.endTime ?? "",
          }
        : null,
    }
  })
}, [user])

const { data: courses, error, loading, reload } = useApi(call)

const visibleCourses = courses?.filter((courseItem) => {
  const matchesTerm =
    !term || courseItem.term === term

  const searchText = committedSearch.toLowerCase()

  const matchesSearch =
    !searchText ||
    courseItem.courseNumber.toLowerCase().includes(searchText) ||
    courseItem.title.toLowerCase().includes(searchText) ||
    courseItem.instructor?.name?.toLowerCase().includes(searchText)

  return matchesTerm && matchesSearch
})

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
          empty={visibleCourses?.length === 0}
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
                  <th className="px-4 py-3 font-medium">Observation</th>
                </tr>
              </thead>
              <tbody>
                {visibleCourses?.map((course) => (
                  <tr key={course.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={`/courses/${course.courseId}`}
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
                    <td className="px-4 py-3">
  <Link
    to="/observation-signup"
    state={{
      courseNumber: course.courseNumber,
      courseTitle: course.title,
      section: course.section,
      semester: course.term,
    }}
    className="whitespace-nowrap font-medium text-utd-green hover:underline"
  >
    Request Observation
  </Link>
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
