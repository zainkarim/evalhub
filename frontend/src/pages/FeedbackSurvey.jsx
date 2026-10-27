import { useState } from "react"
import { api } from "../lib/api"
import { useNavigate } from "react-router-dom"

export default function FeedbackSurvey() {
    const [rating, setRating] = useState("")
    const [feedback, setFeedback] = useState("")
    const [suggestions, setSuggestions] = useState("")

    const handleSubmit = async () => {
        try {
            await api.submitSurvey({
                rating,
                feedback,
                suggestions,
            })

            alert("Your feedback has been submitted successfully!")
            navigate("/")
        } catch (error) {
            alert(error.message)
        }
    }

    const navigate = useNavigate()

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
            <label className="block mt-6"></label>

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
            <button
                type="button"
                onClick={handleSubmit}
                className="mt-6 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
                Submit Feedback
            </button>
        </div>
    )
}