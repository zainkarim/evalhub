import { useEffect, useState } from "react"
import { api } from "../lib/api"

export default function FeedbackSurvey() {
  const [rating, setRating] = useState("")
  const [feedback, setFeedback] = useState("")
  const [suggestions, setSuggestions] = useState("")
  const [surveyStatus, setSurveyStatus] = useState("loading")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    api.getSurveyStatus()
      .then((result) => {
        if (!active) return

        if (result.submitted) {
          setSurveyStatus("submitted")
        } else if (result.available) {
          setSurveyStatus("available")
        } else {
          setSurveyStatus("unavailable")
        }
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setSurveyStatus("error")
      })

    return () => {
      active = false
    }
  }, [])


  const handleSubmit = async () => {
    if (submitting || surveyStatus !== "available") return

    setError("")
    setSubmitting(true)

    try {
      await api.submitSurvey({
        rating,
        feedback,
        suggestions,
      })

      setSurveyStatus("submitted")
    } catch (err) {
      if (err.status === 409 && err.message.includes("already submitted")) {
        setSurveyStatus("submitted")
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }


  if (surveyStatus === "loading") {
    return <p>Loading survey...</p>
  }

  if (surveyStatus === "unavailable") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Process Feedback Survey</h1>
        <p>The feedback survey is not currently available.</p>
      </div>
    )
  }

  if (surveyStatus === "error") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Process Feedback Survey</h1>
        <p role="alert" className="text-red-600">{error}</p>
      </div>
    )
  }


  if (surveyStatus === "submitted") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Process Feedback Survey</h1>
        <p className="text-utd-green">
          Thanks, your feedback was submitted.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Process Feedback Survey</h1>
      <p>Please share your feedback about the observation process.</p>
      <label>
        How satisfied were you with the observation process?
        <select
          className="mt-2 block w-full rounded border p-2"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        >
          <option value="">Select a rating</option>
          <option value="5">Very satisfied</option>
          <option value="4">Satisfied</option>
          <option value="3">Neutral</option>
          <option value="2">Dissatisfied</option>
          <option value="1">Very dissatisfied</option>
        </select>
      </label>


      <label className="block">
        Do you have any feedback about the observation process?
        <textarea
          className="mt-2 block w-full rounded border p-2"
          rows={4}
          placeholder="Share your feedback..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </label>

      <label className="block mt-6">
        What improvements would you suggest for the observation process?
        <textarea
          className="mt-2 block w-full rounded border p-2"
          rows={4}
          placeholder="Share your suggestions for improvement..."
          value={suggestions}
          onChange={(e) => setSuggestions(e.target.value)}
        />
      </label>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-utd-green px-6 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}