import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"

function ObservationSignup() {
  const location = useLocation()
  const selectedCourse = location.state
  const { user } = useAuth()

  const [availableCourses, setAvailableCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [semester, setSemester] = useState(
    selectedCourse?.semester || ""
  )

  const [course, setCourse] = useState(
    selectedCourse?.courseNumber || ""
  )

  const [section, setSection] = useState(
    selectedCourse?.section || ""
  )

  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true)
        setError("")

        const [coursesResponse, sectionsResponse, termsResponse] =
          await Promise.all([
            api.listCourses({}),
            api.listSections(
              user?.role === "faculty" && user?.teacherId
                ? { teacherId: user.teacherId }
                : {}
            ),
            api.listTerms({}),
          ])

        const courses = coursesResponse.data ?? []
        const sections = sectionsResponse.data ?? []
        const terms = termsResponse.data ?? []

        const combined = sections.map((sectionItem) => {
          const courseItem = courses.find(
            (item) => item.id === sectionItem.courseId
          )

          const termItem = terms.find(
            (item) => item.id === sectionItem.termId
          )

          const termName = termItem
            ? `${
                termItem.season.charAt(0).toUpperCase() +
                termItem.season.slice(1)
              } ${termItem.year}`
            : "Unknown Term"

          return {
            id: sectionItem.id,
            courseId: sectionItem.courseId,
            courseNumber: courseItem
              ? `${courseItem.subject} ${courseItem.courseNumber}`
              : "Unknown Course",
            title: courseItem?.title ?? "",
            section: sectionItem.sectionNumber,
            semester: termName,
          }
        })

        setAvailableCourses(combined)
      } catch (err) {
        setError(err.message || "Unable to load courses.")
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadCourses()
    }
  }, [user])

  const semesters = [
    ...new Set(availableCourses.map((item) => item.semester)),
  ]

  const coursesForSemester = availableCourses.filter(
    (item) => !semester || item.semester === semester
  )

  const uniqueCourses = Array.from(
    new Map(
      coursesForSemester.map((item) => [
        item.courseNumber,
        item,
      ])
    ).values()
  )

  const sectionsForCourse = availableCourses.filter(
    (item) =>
      item.courseNumber === course &&
      item.semester === semester
  )

  const handleSemesterChange = (event) => {
    setSemester(event.target.value)
    setCourse("")
    setSection("")
    setSubmitted(false)
  }

  const handleCourseChange = (event) => {
    setCourse(event.target.value)
    setSection("")
    setSubmitted(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!semester || !course || !section) {
      return
    }

    setSubmitted(true)
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading courses...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/courses"
          className="text-sm font-medium text-utd-green hover:underline"
        >
          ← Back to Courses
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        Observation Sign-Up
      </h1>

      <p className="mt-1 text-sm text-muted">
        Select the course and section you would like to have observed.
      </p>

      <div className="mt-6 max-w-2xl rounded border border-line bg-white p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Semester
            </label>

            <select
              value={semester}
              onChange={handleSemesterChange}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Select semester</option>

              {semesters.map((semesterItem) => (
                <option key={semesterItem} value={semesterItem}>
                  {semesterItem}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Course
            </label>

            <select
              value={course}
              onChange={handleCourseChange}
              disabled={!semester}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-muted"
            >
              <option value="">
                {semester
                  ? "Select course"
                  : "Select a semester first"}
              </option>

              {uniqueCourses.map((courseItem) => (
                <option
                  key={courseItem.courseNumber}
                  value={courseItem.courseNumber}
                >
                  {courseItem.courseNumber} - {courseItem.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Section
            </label>

            <select
              value={section}
              onChange={(event) => {
                setSection(event.target.value)
                setSubmitted(false)
              }}
              disabled={!course}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-muted"
            >
              <option value="">
                {course
                  ? "Select section"
                  : "Select a course first"}
              </option>

              {sectionsForCourse.map((courseItem) => (
                <option
                  key={courseItem.id}
                  value={courseItem.section}
                >
                  Section {courseItem.section}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Submit Observation Request
          </button>
        </form>

        {submitted && (
          <div className="mt-5 rounded border border-line bg-gray-50 p-4 text-sm">
            <span className="font-medium text-utd-green">
              Observation request submitted.
            </span>

            <p className="mt-1 text-muted">
              {course} -{" "}
              {availableCourses.find(
                (item) =>
                  item.courseNumber === course &&
                  item.semester === semester
              )?.title ?? "Course"}
              , Section {section}, {semester}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ObservationSignup