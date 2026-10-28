import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import StatusBadge from "../components/StatusBadge"
import { Input, PageHeader, Select, Table, TableCard, Td, Th } from "../components/ui"
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
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        subtitle={
          committee
            ? "All course sections, their instructors, and whether they have an observation sign-up."
            : "Your course sections available for observation sign-up."
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            committee
              ? "Search by course number, title, or instructor"
              : "Search by course number or title"
          }
          aria-label="Search courses"
          className="max-w-sm"
        />
        <Select
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label="Filter by term"
          className="w-auto"
        >
          <option value="">All terms</option>
          {terms.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>

      <StateBlock
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton="table"
        empty={visibleCourses?.length === 0}
        emptyMessage="No courses match these filters. Clear the search or pick another term."
      >
        <TableCard maxHeight>
          <Table minWidth="48rem">
            <thead>
              <tr>
                <Th>Course</Th>
                <Th>Term</Th>
                <Th>Section</Th>
                {committee && <Th>Instructor</Th>}
                <Th>Meets</Th>
                <Th>{committee ? "Observation" : "Action"}</Th>
              </tr>
            </thead>
            <tbody>
              {visibleCourses?.map((course) => (
                <tr key={course.id} className="border-b border-line last:border-0">
                  <Td>
                    <Link to={`/courses/${course.courseId}`} className="font-medium text-primary hover:underline">
                      {course.courseNumber}
                    </Link>
                    <span className="block text-muted">{course.title}</span>
                  </Td>
                  <Td>{course.term}</Td>
                  <Td>{course.section}</Td>
                  {committee && <Td>{course.instructor?.name ?? "—"}</Td>}
                  <Td>
                    {course.schedule
                      ? course.schedule.startTime && course.schedule.endTime
                        ? `${course.schedule.days} ${course.schedule.startTime}–${course.schedule.endTime}`
                        : course.schedule.days
                      : "—"}
                  </Td>
                  <Td>
                    {course.signUp ? (
                      <div>
                        <StatusBadge status={course.signUp.status} map={ASSESSMENT_STATUS} />
                        <Link
                          to={`/assessments/${course.signUp.id}`}
                          className="mt-1 block whitespace-nowrap text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                      </div>
                    ) : course.open && !committee ? (
                      <Link
                        to="/observation-signup"
                        state={{ sectionId: course.id }}
                        className="whitespace-nowrap font-medium text-primary hover:underline"
                      >
                        Select for Observation
                      </Link>
                    ) : (
                      <span className="text-muted">{course.open ? "Not signed up" : "—"}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      </StateBlock>
    </div>
  )
}

export default Courses
