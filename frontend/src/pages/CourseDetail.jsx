import { useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

function CourseDetail() {
  const { id } = useParams()
  const call = useCallback(() => api.getCourse(id), [id])
  const { data: course, error, loading, reload } = useApi(call)

  return (
    <div>
      <Link to="/courses" className="text-sm text-muted hover:text-ink">
        Back to courses
      </Link>

      <div className="mt-4">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {course && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {course.courseNumber} · Section {course.section}
              </h1>
              <p className="mt-1 text-muted">{course.title}</p>

              <section className="mt-8 rounded border border-line bg-white p-6">
                <h2 className="text-sm font-semibold">Section details</h2>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                  <Field label="Term">{course.term}</Field>
                  <Field label="Focus area">{course.focusArea ?? "—"}</Field>
                  <Field label="Credit hours">{course.creditHours ?? "—"}</Field>
                  <Field label="Instructor">
                    {course.instructor ? (
                      <Link
                        to={`/professors/${course.instructor.id}`}
                        className="text-utd-green hover:underline"
                      >
                        {course.instructor.name}
                      </Link>
                    ) : (
                      "Not assigned"
                    )}
                  </Field>
                  <Field label="Enrollment">
                    {course.enrolled ?? "—"}
                    {course.capacity ? ` of ${course.capacity}` : ""}
                  </Field>
                  <Field label="Location">
                    {course.schedule?.location ?? "—"}
                  </Field>
                  <Field label="Meeting days">
                    {course.schedule?.days ?? "—"}
                  </Field>
                  <Field label="Meeting time">
                    {course.schedule
                      ? `${course.schedule.startTime}–${course.schedule.endTime}`
                      : "—"}
                  </Field>
                </dl>
              </section>

              <section className="mt-6 rounded border border-line bg-white p-6">
                <h2 className="text-sm font-semibold">Previous instructors</h2>
                <p className="mt-1 text-sm text-muted">
                  Pulled from the UTD Course Book. Used to suggest observers who
                  have taught this course.
                </p>

                {course.pastInstructors?.length ? (
                  <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
                    {course.pastInstructors.map((entry) => (
                      <li
                        key={`${entry.term}-${entry.name}`}
                        className="flex justify-between py-2.5"
                      >
                        <span>{entry.name}</span>
                        <span className="text-muted">{entry.term}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted">
                    No prior terms on record for this course.
                  </p>
                )}
              </section>
            </>
          )}
        </StateBlock>
      </div>
    </div>
  )
}

export default CourseDetail
