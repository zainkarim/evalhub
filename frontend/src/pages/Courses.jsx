import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import {
  ASSESSMENT_STATUS,
  formatDays,
  formatTerm,
  formatTime,
  fullName,
  todayISO,
  toDateOnly,
} from "../lib/format"
import { isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"

const canSignUp = (term) =>
  term && term.season !== "summer" && toDateOnly(term.endDate) >= todayISO()

function Courses() {
  const { user } = useAuth()
  const committee = isAC(user)
  const [term, setTerm] = useState("")
  const [search, setSearch] = useState("")
  const [committedSearch, setCommittedSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setCommittedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Faculty see their own sections; the committee sees every section plus who
  // teaches it and whether it already has an observation sign-up.
  const call = useCallback(async () => {
    const [coursesResponse, sectionsResponse, termsResponse, professorsResponse, signUps] =
      await Promise.all([
        api.listCourses({}),
        api.listSections(
          !committee && user?.teacherId ? { teacherId: user.teacherId } : {},
        ),
        api.listTerms({}),
        committee ? api.listProfessors({}) : Promise.resolve({ data: [] }),
        committee ? api.listAssessments({}) : api.myAssessments(),
      ])

    const courses = coursesResponse.data ?? []
    const terms = termsResponse.data ?? []
    const professors = professorsResponse.data ?? []
    const taken = new Map((signUps.data ?? []).map((item) => [item.sectionId, item]))

    return (sectionsResponse.data ?? []).map((section) => {
      const course = courses.find((item) => item.id === section.courseId)
      const courseTerm = terms.find((item) => item.id === section.termId)
      const professor = professors.find((item) => item.id === section.teacherId)

      return {
        id: section.id,
        courseId: section.courseId,
        courseNumber: course ? `${course.subject} ${course.courseNumber}` : "Unknown Course",
        title: course?.title ?? "",
        term: formatTerm(courseTerm),
        open: canSignUp(courseTerm),
        section: section.sectionNumber,
        instructor: committee
          ? professor
            ? { id: professor.id, name: fullName(professor) }
            : null
          : { id: user.teacherId, name: fullName(user) },
        schedule: section.meetingDays
          ? {
              days: formatDays(section.meetingDays),
              startTime: section.startTime ? formatTime(section.startTime) : "",
              endTime: section.endTime ? formatTime(section.endTime) : "",
            }
          : null,
        signUp: taken.get(section.id) ?? null,
      }
    })
  }, [committee, user])

  const { data: courses, error, loading, reload } = useApi(call)

  const terms = [...new Set((courses ?? []).map((item) => item.term))]

  const visibleCourses = courses?.filter((courseItem) => {
    const matchesTerm = !term || courseItem.term === term
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
        {committee
          ? "All course sections, their instructors, and whether they have an observation sign-up."
          : "Your course sections available for observation sign-up."}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            committee
              ? "Search by course number, title, or instructor"
              : "Search by course number or title"
          }
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
          <div className="relative overflow-x-auto rounded border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  {committee && <th className="px-4 py-3 font-medium">Instructor</th>}
                  <th className="px-4 py-3 font-medium">Meets</th>
                  <th className="px-4 py-3 font-medium">
                    {committee ? "Observation" : "Action"}
                  </th>
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
                    {committee && (
                      <td className="px-4 py-3">{course.instructor?.name ?? "—"}</td>
                    )}
                    <td className="px-4 py-3">
                      {course.schedule
                        ? course.schedule.startTime && course.schedule.endTime
                          ? `${course.schedule.days} ${course.schedule.startTime}–${course.schedule.endTime}`
                          : course.schedule.days
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {course.signUp ? (
                        <div>
                          <StatusBadge status={course.signUp.status} map={ASSESSMENT_STATUS} />
                          <Link
                            to={`/assessments/${course.signUp.id}`}
                            className="mt-1 block whitespace-nowrap text-xs font-medium text-utd-green hover:underline"
                          >
                            View
                          </Link>
                        </div>
                      ) : course.open && !committee ? (
                        <Link
                          to="/observation-signup"
                          state={{ sectionId: course.id }}
                          className="whitespace-nowrap font-medium text-utd-green hover:underline"
                        >
                          Select for Observation
                        </Link>
                      ) : (
                        <span className="text-muted">
                          {course.open ? "Not signed up" : "—"}
                        </span>
                      )}
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
