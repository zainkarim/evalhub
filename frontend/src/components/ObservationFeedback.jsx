import { useEffect, useState } from "react"
import { api } from "../lib/api"

const scale = (maxScore) => Array.from({ length: maxScore }, (_, index) => index + 1)

// The observer's in-app copy of the observation template (#33, requirements
// §4.4–4.5): one rating question per active criterion, each on its own scale,
// plus written notes. The observer answers; they can't change the questions.
// Answers can be saved and changed until the observer signs off.
//
//   preview  -> the committee's read-only preview of the current template
//               (pass `criteria`; nothing is loaded or saved)
function ObservationFeedback({ observationId, criteria: given, preview = false, onSaved }) {
  const [loaded, setLoaded] = useState(null)
  const criteria = given ?? loaded
  const [loadError, setLoadError] = useState("")
  const [scores, setScores] = useState({})
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [savedAt, setSavedAt] = useState(null)

  // The observer's form loads the active criteria; the preview is handed them.
  const needsLoad = !given
  useEffect(() => {
    if (!needsLoad) return undefined
    let active = true
    api
      .listCriteria()
      .then((result) => active && setLoaded(result?.data ?? []))
      .catch((err) => active && setLoadError(err.message))
    return () => {
      active = false
    }
  }, [needsLoad])

  if (loadError) {
    return <p className="text-sm text-muted">The observation form couldn&apos;t load: {loadError}</p>
  }
  if (!criteria) return <p className="text-sm text-muted">Loading the observation form…</p>
  if (criteria.length === 0) {
    return (
      <p className="text-sm text-muted">
        The committee hasn&apos;t set up any evaluation criteria yet, so there is nothing to fill in.
      </p>
    )
  }

  const answered = criteria.filter((criterion) => scores[criterion.id]).length
  const complete = answered === criteria.length
  const percent = Math.round((answered / criteria.length) * 100)

  const choose = (criterionId, score) => {
    setScores((current) => ({ ...current, [criterionId]: score }))
    setSavedAt(null)
  }

  async function save(event) {
    event.preventDefault()
    if (preview || !complete) return
    setBusy(true)
    setError("")
    try {
      await api.submitResponses(
        observationId,
        criteria.map((criterion) => ({ criterionId: criterion.id, score: scores[criterion.id] })),
        notes.trim(),
      )
      setSavedAt(new Date())
      onSaved?.()
    } catch (err) {
      setError(err.message || "The form couldn't be saved.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      {!preview && (
        <div className="mb-3 flex items-center justify-between gap-4 text-sm">
          <span className={complete ? "font-medium text-utd-green-dark" : "text-muted"}>
            {answered} of {criteria.length} rated
          </span>
          <span
            className="h-1.5 w-32 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={criteria.length}
            aria-valuenow={answered}
            aria-label="Questions rated"
          >
            <span
              className="block h-full rounded-full bg-utd-green transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </span>
        </div>
      )}

      <ol className="divide-y divide-line rounded-md border border-line bg-white">
        {criteria.map((criterion, index) => {
          const value = scores[criterion.id]
          const labelId = `criterion-${criterion.id}-label`
          return (
            <li
              key={criterion.id}
              className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
            >
              <div className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    value ? "bg-utd-green text-white" : "border border-line text-muted"
                  }`}
                >
                  {value ? "✓" : index + 1}
                </span>
                <div className="min-w-0">
                  <p id={labelId} className="text-sm font-medium">
                    {criterion.name}
                  </p>
                  {criterion.description && (
                    <p className="mt-0.5 text-xs text-muted">{criterion.description}</p>
                  )}
                </div>
              </div>

              <div className="pl-8 sm:pl-0">
                <div
                  role="radiogroup"
                  aria-labelledby={labelId}
                  className="inline-flex overflow-hidden rounded-md border border-line"
                >
                  {scale(criterion.maxScore).map((step) => {
                    const selected = value === step
                    return (
                      <label
                        key={step}
                        className={`flex h-9 w-10 items-center justify-center border-l border-line text-sm first:border-l-0 has-[:focus-visible]:relative has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-utd-green ${
                          selected
                            ? "bg-utd-green-dark font-semibold text-white"
                            : preview
                              ? "bg-white text-muted"
                              : "cursor-pointer bg-white hover:bg-canvas"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`criterion-${criterion.id}`}
                          value={step}
                          checked={selected}
                          disabled={preview || busy}
                          onChange={() => choose(criterion.id, step)}
                          className="sr-only"
                        />
                        {step}
                      </label>
                    )
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <label htmlFor="observer-notes" className="mt-5 block text-sm font-medium">
        Observation notes
      </label>
      <p className="text-xs text-muted">What worked, what to try next, anything the ratings don&apos;t capture.</p>
      <textarea
        id="observer-notes"
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value)
          setSavedAt(null)
        }}
        rows={5}
        disabled={preview || busy}
        className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm disabled:bg-canvas"
      />

      {!preview && (
        <>
          {error && (
            <p role="alert" className="mt-3 rounded-md border border-utd-orange/40 bg-white px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="submit"
              disabled={!complete || busy}
              className="rounded-md bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save observation form"}
            </button>
            <span role="status" className={`text-xs ${savedAt ? "text-utd-green-dark" : "text-muted"}`}>
              {savedAt
                ? "✓ Saved. You can change your answers until you sign off."
                : complete
                  ? "All questions rated. Save before you sign off."
                  : `Rate ${criteria.length - answered} more ${criteria.length - answered === 1 ? "question" : "questions"} to save.`}
            </span>
          </div>
        </>
      )}
    </form>
  )
}

export default ObservationFeedback
