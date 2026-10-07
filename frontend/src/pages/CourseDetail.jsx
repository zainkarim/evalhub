import { useCallback } from "react"
import { Link, useParams } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { api } from "../lib/api"
import { formatTerm } from "../lib/format"
import { useApi } from "../lib/useApi"

function CourseDetail() {
  const { id } = useParams()

  const call = useCallback(async () => {
    const [course, sectionsResponse, termsResponse] = await Promise.all([
      api.getCourse(id),
      api.listSections({}),
      api.listTerms({}),
    ])

    const sections = (sectionsResponse.data ?? []).filter(
      (section) => section.courseId === Number(id)
    )

    const terms = termsResponse.data ?? []

    const sectionDetails = sections.map((section) => {
      const term = terms.find((item) => item.id === section.termId)

      return {
        ...section,
        termName: formatTerm(term),
      }
    })

    return {
      ...course,
      sections: sectionDetails,
    }
  }, [id])

  const { data: course, error, loading, reload } = useApi(call)

  return (
    <div>
      <Link
        to="/courses"
        className="text-sm text-muted hover:text-ink"
      >
        Back to courses
      </Link>

      <div className="mt-4">
        <StateBlock
          loading={loading}
          error={error}
          onRetry={reload}
        >
          {course && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {course.subject} {course.courseNumber}
              </h1>

              <p className="mt-1 text-muted">
                {course.title}
              </p>

              <section className="mt-8 rounded border border-line bg-white p-6">
                <h2 className="text-sm font-semibold">
                  Course Sections
                </h2>

                {course.sections?.length ? (
                  <div className="relative mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line text-xs text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">
                            Term
                          </th>
                          <th className="px-3 py-2 font-medium">
                            Section
                          </th>
                          <th className="px-3 py-2 font-medium">
                            Meeting Days
                          </th>
                          <th className="px-3 py-2 font-medium">
                            Meeting Time
                          </th>
                          <th className="px-3 py-2 font-medium">
                            Location
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {course.sections.map((section) => (
                          <tr
                            key={section.id}
                            className="border-b border-line last:border-0"
                          >
                            <td className="px-3 py-3">
                              {section.termName}
                            </td>

                            <td className="px-3 py-3">
                              {section.sectionNumber}
                            </td>

                            <td className="px-3 py-3">
                              {section.meetingDays ?? "—"}
                            </td>

                            <td className="px-3 py-3">
                              {section.startTime && section.endTime
                                ? `${section.startTime}–${section.endTime}`
                                : "—"}
                            </td>

                            <td className="px-3 py-3">
                              {section.location ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">
                    No sections currently available for this course.
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