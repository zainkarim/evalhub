import { useEffect, useState } from "react"
import { CheckCircle2, ClipboardList, Clock3 } from "lucide-react"
import { api } from "../lib/api"
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  PageHeader,
  Label,
  Select,
  Textarea,
  ErrorText,
} from "../components/ui"

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
        setError(err.message || "Failed to load survey.")
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
      if (
        err.status === 409 &&
        err.message?.includes("already submitted")
      ) {
        setSurveyStatus("submitted")
      } else {
        setError(err.message || "Failed to submit feedback.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Process Feedback Survey"
        subtitle="Share your experience and help us improve the observation process."
      />

      {surveyStatus === "loading" && (
        <Card className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-muted" />
          <p className="text-sm text-muted">Loading survey...</p>
        </Card>
      )}

      {surveyStatus === "unavailable" && (
        <Card className="py-12 text-center">
          <Clock3 className="mx-auto h-9 w-9 text-muted" />
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Survey Unavailable
          </h2>
          <p className="mt-2 text-sm text-muted">
            The feedback survey is not currently available.
          </p>
        </Card>
      )}

      {surveyStatus === "error" && (
        <Card className="py-12 text-center">
          <h2 className="text-lg font-semibold text-ink">
            Unable to Load Survey
          </h2>
          <ErrorText className="mt-3">{error}</ErrorText>
        </Card>
      )}

      {surveyStatus === "submitted" && (
        <Card className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary-ink" />
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Feedback Submitted
          </h2>
          <p className="mt-2 text-sm text-muted">
            Thank you! Your feedback has been submitted successfully.
          </p>
        </Card>
      )}

      {surveyStatus === "available" && (
        <Card padded={false}>
          <CardHeader
            title="Your Feedback"
            description="Tell us about your experience with the observation process."
          />

          <CardBody className="space-y-6">
            <div>
              <Label htmlFor="survey-rating">
                How satisfied were you with the observation process?
              </Label>
              <Select
                id="survey-rating"
                className="mt-2"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                <option value="">Select a rating</option>
                <option value="5">Very satisfied</option>
                <option value="4">Satisfied</option>
                <option value="3">Neutral</option>
                <option value="2">Dissatisfied</option>
                <option value="1">Very dissatisfied</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="survey-feedback">
                Do you have any feedback about the observation process?
              </Label>
              <Textarea
                id="survey-feedback"
                className="mt-2"
                rows={4}
                placeholder="Share your feedback..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="survey-suggestions">
                What improvements would you suggest for the observation process?
              </Label>
              <Textarea
                id="survey-suggestions"
                className="mt-2"
                rows={4}
                placeholder="Share your suggestions for improvement..."
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
              />
            </div>
          </CardBody>

          <CardFooter>
            {error && <ErrorText className="mr-auto">{error}</ErrorText>}
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
            >
              Submit Feedback
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
