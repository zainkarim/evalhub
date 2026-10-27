import { useCallback, useState } from "react"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import ObservationFeedback from "./ObservationFeedback"
import ScaleMeter from "./ScaleMeter"
import StateBlock from "./StateBlock"

const EMPTY = { name: "", description: "", maxScore: 5, weight: 1 }
const field = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"

function Heading({ title, hint, children }) {
  return (
    <div className="mt-10 flex flex-wrap items-end justify-between gap-3 first:mt-0">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

// Name, scale, weight and guidance for one criterion. Used both for adding a
// new one and, inside its row, for editing an existing one.
function CriterionForm({ initial, submitLabel, busy, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial)
  const idPrefix = initial.id ? `edit-${initial.id}` : "new"

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const name = form.name.trim()
        if (!name) return
        onSubmit({
          name,
          description: form.description.trim() || null,
          maxScore: 5,
          weight: Number(form.weight),
        })
      }}
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem]"
    >
      <div>
        <label htmlFor={`${idPrefix}-name`} className="block text-xs text-muted">
          Question shown to the observer
        </label>
        <input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          maxLength={200}
          required
          className={field}
          placeholder="Clarity of communication"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-weight`} className="block text-xs text-muted">
          Weight
        </label>
        <input
          id={`${idPrefix}-weight`}
          type="number"
          min="0"
          step="0.5"
          value={form.weight}
          onChange={(event) => setForm({ ...form, weight: event.target.value })}
          required
          className={field}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-description`} className="block text-xs text-muted">
          Guidance for the observer (optional)
        </label>
        <textarea
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          maxLength={2000}
          rows={2}
          className={field}
          placeholder="What a high or a low rating means for this question."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          className="rounded-md bg-utd-green px-4 py-2 text-sm font-medium text-white hover:bg-utd-green-dark disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm hover:border-ink"
          >
            Cancel
          </button>
        )}
        <span className="flex items-center gap-2 text-xs text-muted">
          Observers will see <ScaleMeter max={5} />
        </span>
      </div>
    </form>
  )
}

// The committee's editor for the observation form template (#33, requirements
// §4.4): add, edit, deactivate and delete criteria, each with a
// fixed 1–5 rating scale and configurable weight. A criterion already used in an observation can't be
// deleted (the backend returns 409); deactivate it instead, so completed
// records keep their questions.
function CriteriaManager() {
  const call = useCallback(() => api.listCriteria({ includeInactive: true }), [])
  const { data, error, loading, reload } = useApi(call)
  const criteria = data?.data ?? []
  const active = criteria.filter((criterion) => criterion.isActive)

  const [editingId, setEditingId] = useState(null)
  const [addKey, setAddKey] = useState(0) // remounts the add form to clear it
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState("")
  const [notice, setNotice] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  const run = async (action, message) => {
    setBusy(true)
    setActionError("")
    setNotice("")
    try {
      await action()
      if (message) setNotice(message)
      reload()
      return true
    } catch (err) {
      setActionError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async (body) => {
    const ok = await run(
      () =>
        api.createCriterion({
          ...body,
          sortOrder: Math.max(0, ...criteria.map((criterion) => criterion.sortOrder)) + 1,
        }),
      `Added "${body.name}" to the form.`,
    )
    if (ok) setAddKey((key) => key + 1)
  }

  const update = async (criterion, body) => {
    const ok = await run(() => api.updateCriterion(criterion.id, body), `Saved "${body.name}".`)
    if (ok) setEditingId(null)
  }

  const remove = (criterion) => {
    if (!window.confirm(`Delete "${criterion.name}"? This can't be undone.`)) return
    run(() => api.deleteCriterion(criterion.id), `Deleted "${criterion.name}".`).then((ok) => {
      if (ok && editingId === criterion.id) setEditingId(null)
    })
  }

  const toggleActive = (criterion) =>
    run(
      () => api.updateCriterion(criterion.id, { isActive: !criterion.isActive }),
      criterion.isActive
        ? `"${criterion.name}" is off the form for new observations.`
        : `"${criterion.name}" is back on the form.`,
    )

  const th = "px-4 py-3 font-medium"
  const td = "px-4 py-3 align-top"

  return (
    <div>
      {(actionError || notice) && (
        <p
          role={actionError ? "alert" : "status"}
          className={`mb-6 rounded-md border bg-white px-4 py-3 text-sm ${
            actionError ? "border-utd-orange/40" : "border-utd-green/30 text-utd-green-dark"
          }`}
        >
          {actionError || notice}
        </p>
      )}

      <Heading
        title={`Questions on the form (${active.length} active)`}
        hint="Observers answer these in this order using a 1–5 rating scale."
      >
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPreview((current) => !current)}
            aria-expanded={showPreview}
            className="text-sm font-medium text-utd-green hover:underline"
          >
            {showPreview ? "Hide preview" : "Preview as the observer"}
          </button>
        )}
      </Heading>

      {showPreview && active.length > 0 && (
        <div className="mt-3 rounded-md border border-dashed border-utd-green/40 bg-white p-5">
          <p className="mb-4 text-sm text-muted">
            This is the form an observer fills in after the class. Nothing here is saved.
          </p>
          <ObservationFeedback criteria={active} preview />
        </div>
      )}

      <div className="mt-3">
        <StateBlock loading={loading} error={error} onRetry={reload}>
          {data &&
            (criteria.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-white/60 px-5 py-8 text-center text-sm text-muted">
                No questions yet. Add the first one below.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-xs">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs text-muted">
                    <tr>
                      <th className={th}>Question</th>
                      <th className={th}>Scale</th>
                      <th className={th}>Weight</th>
                      <th className={th}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((criterion) =>
                      editingId === criterion.id ? (
                        <tr key={criterion.id} className="border-b border-line bg-canvas last:border-0">
                          <td colSpan={4} className="px-4 py-4">
                            <CriterionForm
                              initial={{
                                id: criterion.id,
                                name: criterion.name,
                                description: criterion.description ?? "",
                                maxScore: criterion.maxScore,
                                weight: criterion.weight,
                              }}
                              submitLabel="Save changes"
                              busy={busy}
                              onSubmit={(body) => update(criterion, body)}
                              onCancel={() => setEditingId(null)}
                            />
                          </td>
                        </tr>
                      ) : (
                        <tr
                          key={criterion.id}
                          className={`border-b border-line last:border-0 ${
                            criterion.isActive ? "" : "bg-canvas text-muted"
                          }`}
                        >
                          <td className={td}>
                            <span className="font-medium">{criterion.name}</span>
                            {!criterion.isActive && (
                              <span className="ml-2 rounded-full border border-line bg-white px-2 py-0.5 text-[11px]">
                                Off the form
                              </span>
                            )}
                            {criterion.description && (
                              <span className="mt-0.5 block text-xs text-muted">
                                {criterion.description}
                              </span>
                            )}
                          </td>
                          <td className={`${td} whitespace-nowrap`}>
                            <span className="flex items-center gap-2">
                              <ScaleMeter max={5} />
                              <span className="text-xs text-muted">1–5</span>
                            </span>
                          </td>
                          <td className={`${td} tabular-nums`}>{criterion.weight}</td>
                          <td className={`${td} whitespace-nowrap text-right`}>
                            <span className="inline-flex gap-4">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setEditingId(criterion.id)
                                  setActionError("")
                                  setNotice("")
                                }}
                                className="font-medium text-utd-green hover:underline disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => toggleActive(criterion)}
                                className="text-utd-green hover:underline disabled:opacity-50"
                              >
                                {criterion.isActive ? "Take off form" : "Put back on form"}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => remove(criterion)}
                                className="text-muted hover:text-utd-orange hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ))}
        </StateBlock>
      </div>

      <Heading
        title="Add a question"
        hint="New questions appear at the end of the form, for observations not yet signed."
      />
      <div className="mt-3 rounded-lg border border-line bg-white p-5 shadow-xs">
        <CriterionForm
          key={addKey}
          initial={EMPTY}
          submitLabel="Add question"
          busy={busy}
          onSubmit={add}
        />
      </div>
    </div>
  )
}

export default CriteriaManager
