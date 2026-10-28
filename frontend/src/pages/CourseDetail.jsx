import { useCallback } from "react"
import { useParams } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Table, TableCard, Td, Th } from "../components/ui"
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
    <div className="space-y-6">
      <PageHeader
        backTo={{ to: "/courses", label: "Back to courses" }}
        title={course ? `${course.subject} ${course.courseNumber}` : "Course"}
        subtitle={course?.title}
      />

      <StateBlock loading={loading} error={error} onRetry={reload} skeleton="table">
        {course && (
          <Card padded={false}>
            <CardHeader title="Course Sections" />
            <CardBody className="pb-6">
              {course.sections?.length ? (
                <TableCard>
                  <Table minWidth="36rem">
                    <thead>
                      <tr>
                        <Th>Term</Th>
                        <Th>Section</Th>
                        <Th>Meeting Days</Th>
                        <Th>Meeting Time</Th>
                        <Th>Location</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.sections.map((section) => (
                        <tr key={section.id} className="border-b border-line last:border-0">
                          <Td>{section.termName}</Td>
                          <Td>{section.sectionNumber}</Td>
                          <Td>{section.meetingDays ?? "—"}</Td>
                          <Td>
                            {section.startTime && section.endTime
                              ? `${section.startTime}–${section.endTime}`
                              : "—"}
                          </Td>
                          <Td>{section.location ?? "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableCard>
              ) : (
                <EmptyState compact titleAs="p" title="No sections currently available for this course" />
              )}
            </CardBody>
          </Card>
        )}
      </StateBlock>
    </div>
  )
}

export default CourseDetail
