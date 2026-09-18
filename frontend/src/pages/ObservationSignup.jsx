import { useState } from "react";
import "./ObservationSignup.css";

function ObservationSignup() {
  // Store the professor's selected semester, course, and section
  const [semester, setSemester] = useState("");
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");

  // Tracks whether the observation request was submitted
  const [submitted, setSubmitted] = useState(false);

  // Sample courses and their available sections
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
  };

  // Runs when a professor selects a different course
  const handleCourseChange = (event) => {
    setCourse(event.target.value);

    // Reset the section because each course may have different sections
    setSection("");
    setSubmitted(false);
  };

  // Runs when the professor submits the form
  const handleSubmit = (event) => {
    event.preventDefault();

    // Do not submit until all required fields are selected
    if (!semester || !course || !section) {
      return;
    }

    // Show the confirmation message
    setSubmitted(true);
  };

  return (
    <div className="observation-page">
      <div className="observation-card">

        {/* Page heading */}
        <h1>Observation Sign-Up</h1>

        <p className="observation-description">
          Select the course and section you would like to have observed.
        </p>

        {/* Observation request form */}
        <form onSubmit={handleSubmit}>

          {/* Semester selection */}
          <div className="form-group">
            <label>Semester</label>
            <select
              value={semester}
              onChange={(e) => {
                setSemester(e.target.value);
                setSubmitted(false);
              }}
            >
              <option value="">Select semester</option>
              <option value="Fall 2026">Fall 2026</option>
              <option value="Spring 2027">Spring 2027</option>
              <option value="Fall 2027">Fall 2027</option>
            </select>
          </div>

          {/* Course selection */}
          <div className="form-group">
            <label>Course</label>
            <select
              value={course}
              onChange={handleCourseChange}
            >
              <option value="">Select course</option>

              {Object.entries(courses).map(([courseNumber, courseInfo]) => (
                <option key={courseNumber} value={courseNumber}>
                  {courseNumber} - {courseInfo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section selection */}
          <div className="form-group">
            <label>Section</label>
            <select
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                setSubmitted(false);
              }}
              disabled={!course}
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

          {/* Submit the observation request */}
          <button type="submit" className="submit-button">
            Submit Observation Request
          </button>
        </form>

        {/* Show confirmation after successful submission */}
        {submitted && (
          <p className="success-message">
            Observation request submitted for {course} -{" "}
            {courses[course].name}, Section {section}, {semester}.
          </p>
        )}

      </div>
    </div>
  );
}

export default ObservationSignup;