import { useEffect, useState } from "react"
import { api } from "../lib/api"
import { Callout, Label, SkeletonText, StickyActionBar, Textarea, Button } from "./ui"
import { useToast } from "./ui/toast-context"

const scale = (maxScore) => Array.from({ length: maxScore }, (_, index) => index + 1)

// The observer's in-app copy of the observation template (#33, requirements
// §4.4–4.5): one rating question per active criterion, each on its own scale,
// plus written notes. The observer answers; they can't change the questions.
// Answers can be saved and changed until the observer signs off.
//
//   preview  -> the committee's read-only preview of the current template
//               (pass `criteria`; nothing is loaded or saved)
function ObservationFeedback({ observationId, criteria: given, preview = false, onSaved }) {
  const toast = useToast()
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
    return (
      <Callout tone="danger" role="alert">
        The observation form couldn&apos;t load: {loadError}
      </Callout>
    )
  }
  if (!criteria) return <SkeletonText lines={4} />
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
      toast.success("Observation form saved.")
      onSaved?.()
    } catch (err) {
      setError(err.message || "The form couldn't be saved.")
    } finally {
      setBusy(false)
    }
  }

  const statusText = savedAt
    ? "Saved. You can change your answers until you sign off."
    : complete
      ? "All questions rated. Save before you sign off."
      : `Rate ${criteria.length - answered} more ${criteria.length - answered === 1 ? "question" : "questions"} to save.`

  return (
    <form onSubmit={save}>
      {!preview && (
        <div className="mb-3 flex items-center justify-between gap-4 text-sm">
          <span className={complete ? "font-medium text-success" : "text-muted"}>
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
              className="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </span>
        </div>
      )}

      <ol className="divide-y divide-line rounded-card border border-line bg-surface">
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
                    value ? "bg-primary text-primary-fg" : "border border-line text-muted"
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
                {/* A segmented control made of real radio buttons: Tab moves into the
                    group, the arrow keys change the rating. */}
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
                        className={`flex h-9 w-10 items-center justify-center border-l border-line text-sm tabular-nums first:border-l-0 has-[:focus-visible]:relative has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                          selected
                            ? "bg-primary font-semibold text-primary-fg"
                            : preview
                              ? "bg-surface text-muted"
                              : "cursor-pointer bg-surface hover:bg-surface-2"
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

      <Label htmlFor="observer-notes" className="mt-5">
        Observation notes
      </Label>
      <p className="text-xs text-muted">What worked, what to try next, anything the ratings don&apos;t capture.</p>
      <Textarea
        id="observer-notes"
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value)
          setSavedAt(null)
        }}
        rows={5}
        disabled={preview || busy}
        className="mt-2"
      />

      {!preview && (
        <>
          {error && (
            <Callout tone="danger" role="alert" className="mt-3">
              {error}
            </Callout>
          )}
          <StickyActionBar className="mt-6">
            <span role="status" className={`mr-auto text-xs ${savedAt ? "text-success" : "text-muted"}`}>
              {statusText}
            </span>
            <Button type="submit" disabled={!complete} loading={busy}>
              {busy ? "Saving…" : "Save observation form"}
            </Button>
          </StickyActionBar>
        </>
      )}
    </form>
  )
}

export default ObservationFeedback
