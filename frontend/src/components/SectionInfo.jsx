import { Link } from "react-router-dom"
import { courseLabel, formatMeeting, formatTerm, fullName } from "../lib/format"

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

// Course + section facts, shown wherever a sign-up needs context. `section` is
// the nested view the workflow endpoints return (section.course, section.term).
function SectionInfo({ section, instructor, className = "" }) {
  if (!section) return null
  return (
    <dl
      className={`grid grid-cols-2 gap-x-8 gap-y-4 rounded border border-line bg-white p-5 sm:grid-cols-3 ${className}`}
    >
      <Field label="Course">
        <Link
          to={`/courses/${section.course?.id}`}
          className="font-medium text-utd-green hover:underline"
        >
          {courseLabel(section.course)}
        </Link>
        <span className="block text-muted">{section.course?.title}</span>
      </Field>
      <Field label="Term">{formatTerm(section.term)}</Field>
      <Field label="Section">{section.sectionNumber}</Field>
      <Field label="Meets">{formatMeeting(section)}</Field>
      <Field label="Location">{section.location ?? "—"}</Field>
      {instructor && <Field label="Instructor">{fullName(instructor)}</Field>}
    </dl>
  )
}

export { Field }
export default SectionInfo
