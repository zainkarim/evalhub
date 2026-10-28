import { useCallback, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import SectionInfo from "../components/SectionInfo"
import StateBlock from "../components/StateBlock"
import { Button, Callout, Card, Label, PageHeader, Select, StickyActionBar } from "../components/ui"
import { useToast } from "../components/ui/toast-context"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import { courseLabel, formatDate, formatTerm, fullName, todayISO, toDateOnly } from "../lib/format"
import { isAC } from "../lib/roles"
import { useApi } from "../lib/useApi"

// Only current or upcoming Spring/Fall terms take sign-ups (summer terms are
// outside the evaluation cycle — requirements §4.1).
const canSignUp = (term) =>
  term && term.season !== "summer" && toDateOnly(term.endDate) >= todayISO()

// Faculty sign-ups close with the sign-up deadline; the committee can still sign someone up.
const closedOn = (term) =>
  term?.signupDeadline && todayISO() > toDateOnly(term.signupDeadline) ? term.signupDeadline : null

function ObservationSignup() {
  const { user } = useAuth()
  const toast = useToast()
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
    if (!selected || selected.signUp || (!committee && closedOn(selected.section.term))) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const assessment = await api.signUp(selected.id, committee ? Number(teacherId) : undefined)
      setCreated(assessment)
      toast.success("Observation sign-up submitted.")
      reload()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const professorOptions = professors?.data ?? []
  const cannotSubmit =
    !selected ||
    Boolean(selected.signUp) ||
    (!committee && Boolean(closedOn(selected.section.term)))

  return (
    <div className="space-y-6">
      <PageHeader
        backTo={{ to: "/observations", label: "Back to Observations" }}
        title="Observation Sign-Up"
        subtitle={
          committee
            ? "Sign a professor up for a peer observation of one of their course sections."
            : "Select the course and section you would like to have observed."
        }
      />

      <StateBlock loading={loading} error={error} onRetry={reload} skeleton="form">
        {created ? (
          <Card className="max-w-2xl text-sm">
            <p className="font-medium text-success">✓ Observation sign-up submitted.</p>
            <p className="mt-1 text-muted">
              {courseLabel(created.section.course)} · Section {created.section.sectionNumber} ·{" "}
              {formatTerm(created.section.term)}
            </p>
            <p className="mt-3 text-muted">
              {created.selectionStartedAt
                ? "Observer selection has already started, so the list is built now. "
                : `Next: observer selection opens after the sign-up deadline${created.signupDeadline ? ` (${formatDate(created.signupDeadline)})` : ""}. `}
              You will get a notification when your list is ready (none if no one is eligible yet;
              the committee is alerted). You&apos;ll then see up to five professors from your school
              who have taught this course level, choose one and offer 4–8 dates, and send the
              request yourself. They confirm one. No approval is needed.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button to={`/assessments/${created.id}`}>Open sign-up</Button>
              <Button variant="secondary" onClick={() => resetFrom(1)}>
                Sign up another section
              </Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="max-w-2xl space-y-5">
              {committee && (
                <div>
                  <Label htmlFor="professor" className="mb-2">
                    Professor
                  </Label>
                  <Select
                    id="professor"
                    value={teacherId}
                    onChange={(event) => {
                      setTeacherId(event.target.value ? Number(event.target.value) : "")
                      resetFrom(1)
                    }}
                  >
                    <option value="">Select professor</option>
                    {professorOptions.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {fullName(professor)}
                        {professor.id === user?.teacherId ? " (you)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="semester" className="mb-2">
                  Semester
                </Label>
                <Select
                  id="semester"
                  value={semester}
                  onChange={(event) => {
                    resetFrom(2)
                    setSemester(event.target.value)
                  }}
                  disabled={!teacherId}
                >
                  <option value="">Select semester</option>
                  {semesters.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="course" className="mb-2">
                  Course
                </Label>
                <Select
                  id="course"
                  value={courseId}
                  onChange={(event) => {
                    resetFrom(3)
                    setCourseId(event.target.value)
                  }}
                  disabled={!semester}
                >
                  <option value="">{semester ? "Select course" : "Select a semester first"}</option>
                  {coursesInSemester.map((item) => (
                    <option key={item.courseId} value={item.courseId}>
                      {courseLabel(item.section.course)} – {item.section.course.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="section" className="mb-2">
                  Section
                </Label>
                <Select
                  id="section"
                  value={sectionId}
                  onChange={(event) => {
                    setCreated(null)
                    setSubmitError("")
                    setSectionId(event.target.value)
                  }}
                  disabled={!courseId}
                >
                  <option value="">{courseId ? "Select section" : "Select a course first"}</option>
                  {sectionsForCourse.map((item) => (
                    <option key={item.id} value={item.id}>
                      Section {item.section.sectionNumber}
                      {item.signUp ? " (already signed up)" : ""}
                    </option>
                  ))}
                </Select>
              </div>

              {selected && (
                <div>
                  <p className="mb-2 text-sm font-medium">Section details</p>
                  <SectionInfo section={selected.section} />
                  {!committee && closedOn(selected.section.term) && (
                    <Callout tone="warning" role="alert" className="mt-2">
                      Sign-ups closed on {formatDate(closedOn(selected.section.term))}. Ask the
                      committee to sign you up.
                    </Callout>
                  )}
                  {selected.section.term?.signupDeadline && !closedOn(selected.section.term) && (
                    <p className="mt-2 text-xs text-muted">
                      Sign-up deadline: {formatDate(selected.section.term.signupDeadline)}.
                      Observer selection opens after it, and you will get a notification when your
                      list is ready.
                    </p>
                  )}
                </div>
              )}

              {teacherId && items?.length === 0 && (
                <Callout tone="info">
                  {committee
                    ? "This professor has no sections in a current or upcoming Spring/Fall term."
                    : "You have no sections in a current or upcoming Spring/Fall term. Sections appear here once they are listed with you as instructor."}
                </Callout>
              )}

              {selected?.signUp && (
                <Callout tone="info">
                  This section already has an observation sign-up.{" "}
                  <Link
                    to={`/assessments/${selected.signUp.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    View it
                  </Link>
                  . Each section is observed once per semester.
                </Callout>
              )}

              {submitError && (
                <Callout tone="danger" role="alert">
                  {submitError}
                </Callout>
              )}
            </Card>

            <StickyActionBar back={{ to: "/observations", label: "Cancel" }}>
              <Button type="submit" disabled={cannotSubmit} loading={submitting}>
                {submitting ? "Submitting…" : "Submit Observation Request"}
              </Button>
            </StickyActionBar>
          </form>
        )}
      </StateBlock>
    </div>
  )
}

export default ObservationSignup
