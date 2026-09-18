import { useState } from "react";
import "./ObservationSignup.css";

function ObservationSignup() {
  // Store the professor's selected semester, course, and section
  const [semester, setSemester] = useState("");
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");

  // Tracks whether the observation request was submitted
  const [submitted, setSubmitted] = useState(false);

  // Runs when the professor submits the form
  const handleSubmit = (event) => {
    // Prevent the page from refreshing
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
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">Select semester</option>
              <option value="Fall 2026">Fall 2026</option>
              <option value="Spring 2027">Spring 2027</option>
            </select>
          </div>

          {/* Course selection */}
          <div className="form-group">
            <label>Course</label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="">Select course</option>
              <option value="CS 3354">
                CS 3354 - Software Engineering
              </option>
              <option value="CS 4349">
                CS 4349 - Advanced Algorithm Design
              </option>
              <option value="CS 3345">
                CS 3345 - Data Structures
              </option>
            </select>
          </div>

          {/* Section selection */}
          <div className="form-group">
            <label>Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">Select section</option>
              <option value="001">Section 001</option>
              <option value="002">Section 002</option>
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
            Observation request submitted for {course}, Section {section},
            {` ${semester}`}.
          </p>
        )}

      </div>
    </div>
  );
}

export default ObservationSignup;
