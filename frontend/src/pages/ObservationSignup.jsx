import { useState } from "react"

function ObservationSignup() {
  const [semester, setSemester] = useState("")
  const [course, setCourse] = useState("")
  const [section, setSection] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const courses = {
    "CS 3354": {
      name: "Software Engineering",
      sections: ["001", "002", "003"],
    },
    "CS 3345": {
      name: "Data Structures and Algorithmic Analysis",
      sections: ["001", "002", "004"],
    },
    "CS 4348": {
      name: "Operating Systems Concepts",
      sections: ["001", "002"],
    },
    "CS 4349": {
      name: "Advanced Algorithm Design",
      sections: ["001", "002"],
    },
    "CS 4375": {
      name: "Introduction to Machine Learning",
      sections: ["001", "003"],
    },
    "CS 4384": {
      name: "Automata Theory",
      sections: ["001", "002"],
    },
    "CS 6360": {
      name: "Database Design",
      sections: ["001", "002"],
    },
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

  return (
    <div>
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
              onChange={(event) => {
                setSemester(event.target.value)
                setSubmitted(false)
              }}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Select semester</option>
              <option value="Fall 2026">Fall 2026</option>
              <option value="Spring 2027">Spring 2027</option>
              <option value="Fall 2027">Fall 2027</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Course
            </label>

            <select
              value={course}
              onChange={handleCourseChange}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Select course</option>

              {Object.entries(courses).map(([courseNumber, courseInfo]) => (
                <option key={courseNumber} value={courseNumber}>
                  {courseNumber} - {courseInfo.name}
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
                {course ? "Select section" : "Select a course first"}
              </option>

              {course &&
                courses[course].sections.map((sectionNumber) => (
                  <option key={sectionNumber} value={sectionNumber}>
                    Section {sectionNumber}
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
              {course} - {courses[course].name}, Section {section}, {semester}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ObservationSignup