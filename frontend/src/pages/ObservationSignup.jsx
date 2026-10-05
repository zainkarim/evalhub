import { useCallback, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import SectionInfo from "../components/SectionInfo"
import StateBlock from "../components/StateBlock"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import { courseLabel, formatTerm, fullName, todayISO, toDateOnly } from "../lib/format"
import { isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"

// Only current or upcoming Spring/Fall terms take sign-ups (summer terms are
// outside the evaluation cycle — requirements §4.1).
const canSignUp = (term) =>
  term && term.season !== "summer" && toDateOnly(term.endDate) >= todayISO()

const selectClass =
  "w-full rounded border border-line bg-white px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-muted"

function ObservationSignup() {
  const { user } = useAuth()
  const location = useLocation()
  const preselected = location.state?.sectionId ?? null
  const committee = isAC(user)

  // Committee members can also sign a professor up on their behalf.
  const [teacherId, setTeacherId] = useState(user?.teacherId ?? "")
  const [semester, setSemester] = useState("")
  const [courseId, setCourseId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [created, setCreated] = useState(null)
  const [appliedPreselect, setAppliedPreselect] = useState(false)

  const professorsCall = useCallback(
    () => (committee ? api.listProfessors({}) : Promise.resolve({ data: [] })),
    [committee],
  )
  const { data: professors } = useApi(professorsCall)

  const catalogCall = useCallback(async () => {
    if (!teacherId) return []
    const [courses, sections, terms, signUps] = await Promise.all([
      api.listCourses({}),
      api.listSections({ teacherId }),
      api.listTerms({}),
      committee ? api.listAssessments({ teacherId }) : api.myAssessments(),
    ])
    const taken = new Map((signUps.data ?? []).map((item) => [item.sectionId, item]))

    return (sections.data ?? [])
      .map((section) => {
        const course = (courses.data ?? []).find((item) => item.id === section.courseId)
        const term = (terms.data ?? []).find((item) => item.id === section.termId)
        return {
          id: section.id,
          courseId: section.courseId,
          termLabel: formatTerm(term),
          signUp: taken.get(section.id) ?? null,
          section: { ...section, course, term },
        }
      })
      .filter((item) => item.section.course && canSignUp(item.section.term))
  }, [teacherId, committee])

  const { data: items, error, loading, reload } = useApi(catalogCall)

  // Arriving from the Courses page with a section already chosen.
  if (items && preselected && !appliedPreselect) {
    const match = items.find((item) => item.id === preselected)
    setAppliedPreselect(true)
    if (match) {
      setSemester(match.termLabel)
      setCourseId(String(match.courseId))
      setSectionId(String(match.id))
    }
  }

  const semesters = [...new Set((items ?? []).map((item) => item.termLabel))]
  const coursesInSemester = Array.from(
    new Map(
      (items ?? [])
        .filter((item) => item.termLabel === semester)
        .map((item) => [item.courseId, item]),
    ).values(),
  )
  const sectionsForCourse = (items ?? []).filter(
    (item) => item.termLabel === semester && String(item.courseId) === courseId,
  )
  const selected = (items ?? []).find((item) => String(item.id) === sectionId)

  const resetFrom = (level) => {
    setCreated(null)
    setSubmitError("")
    if (level <= 1) setSemester("")
    if (level <= 2) setCourseId("")
    if (level <= 3) setSectionId("")
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selected || selected.signUp) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const assessment = await api.signUp(selected.id, committee ? Number(teacherId) : undefined)
      setCreated(assessment)
      reload()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const professorOptions = professors?.data ?? []

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/observations"
          className="text-sm font-medium text-utd-green hover:underline"
        >
          ← Back to Observations
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Observation Sign-Up</h1>
      <p className="mt-1 text-sm text-muted">
        {committee
          ? "Sign a professor up for a peer observation of one of their course sections."
          : "Select the course and section you would like to have observed."}
      </p>

      <div className="mt-6 max-w-2xl">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          <div className="rounded border border-line bg-white p-6">
            {created ? (
              <div className="text-sm">
                <p className="font-medium text-utd-green">✓ Observation sign-up submitted.</p>
                <p className="mt-1 text-muted">
                  {courseLabel(created.section.course)} · Section {created.section.sectionNumber} ·{" "}
                  {formatTerm(created.section.term)}
                </p>
                <p className="mt-3 text-muted">
                  Next: find your observer candidates (professors from your school who have
                  taught this course level), then choose who to ask.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={`/assessments/${created.id}`}
                    className="rounded bg-utd-green px-4 py-2 font-medium text-white hover:bg-utd-green-dark"
                  >
                    {committee ? "Open sign-up" : "Choose an observer"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => resetFrom(1)}
                    className="rounded border border-line px-4 py-2 hover:border-ink"
                  >
                    Sign up another section
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {committee && (
                  <div>
                    <label htmlFor="professor" className="mb-2 block text-sm font-medium">
                      Professor
                    </label>
                    <select
                      id="professor"
                      value={teacherId}
                      onChange={(event) => {
                        setTeacherId(event.target.value ? Number(event.target.value) : "")
                        resetFrom(1)
                      }}
                      className={selectClass}
                    >
                      <option value="">Select professor</option>
                      {professorOptions.map((professor) => (
                        <option key={professor.id} value={professor.id}>
                          {fullName(professor)}
                          {professor.id === user?.teacherId ? " (you)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="semester" className="mb-2 block text-sm font-medium">
                    Semester
                  </label>
                  <select
                    id="semester"
                    value={semester}
                    onChange={(event) => {
                      resetFrom(2)
                      setSemester(event.target.value)
                    }}
                    disabled={!teacherId}
                    className={selectClass}
                  >
                    <option value="">Select semester</option>
                    {semesters.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="course" className="mb-2 block text-sm font-medium">
                    Course
                  </label>
                  <select
                    id="course"
                    value={courseId}
                    onChange={(event) => {
                      resetFrom(3)
                      setCourseId(event.target.value)
                    }}
                    disabled={!semester}
                    className={selectClass}
                  >
                    <option value="">
                      {semester ? "Select course" : "Select a semester first"}
                    </option>
                    {coursesInSemester.map((item) => (
                      <option key={item.courseId} value={item.courseId}>
                        {courseLabel(item.section.course)} – {item.section.course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="section" className="mb-2 block text-sm font-medium">
                    Section
                  </label>
                  <select
                    id="section"
                    value={sectionId}
                    onChange={(event) => {
                      setCreated(null)
                      setSubmitError("")
                      setSectionId(event.target.value)
                    }}
                    disabled={!courseId}
                    className={selectClass}
                  >
                    <option value="">
                      {courseId ? "Select section" : "Select a course first"}
                    </option>
                    {sectionsForCourse.map((item) => (
                      <option key={item.id} value={item.id}>
                        Section {item.section.sectionNumber}
                        {item.signUp ? " (already signed up)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Section details</p>
                    <SectionInfo section={selected.section} className="bg-canvas" />
                  </div>
                )}

                {teacherId && items?.length === 0 && (
                  <p className="rounded border border-line bg-canvas px-4 py-3 text-sm text-muted">
                    {committee
                      ? "This professor has no sections in a current or upcoming Spring/Fall term."
                      : "You have no sections in a current or upcoming Spring/Fall term. Sections appear here once they are listed with you as instructor."}
                  </p>
                )}

                {selected?.signUp && (
                  <p className="rounded border border-line bg-canvas px-4 py-3 text-sm">
                    This section already has an observation sign-up.{" "}
                    <Link
                      to={`/assessments/${selected.signUp.id}`}
                      className="font-medium text-utd-green hover:underline"
                    >
                      View it
                    </Link>
                    . Each section is observed once per semester.
                  </p>
                )}

                {submitError && (
                  <p
                    role="alert"
                    className="rounded border border-utd-orange/40 bg-white px-3 py-2 text-sm"
                  >
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!selected || Boolean(selected.signUp) || submitting}
                  className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Observation Request"}
                </button>
              </form>
            )}
          </div>
        </StateBlock>
      </div>
    </div>
  )
}

export default ObservationSignup
