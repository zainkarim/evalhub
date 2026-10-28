import { ListChecks } from "lucide-react"
import { useCallback, useState } from "react"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import ObservationFeedback from "./ObservationFeedback"
import ScaleMeter from "./ScaleMeter"
import StateBlock from "./StateBlock"
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  StickyActionBar,
  Table,
  TableCard,
  Td,
  Textarea,
  Th,
} from "./ui"
import { useToast } from "./ui/toast-context"

const EMPTY = { name: "", description: "", maxScore: 5, weight: 1 }
const EDIT_FORM_ID = "criterion-edit-form"

// Name, scale, weight and guidance for one criterion. Used both for adding a
// new one and, inside its row, for editing an existing one. While editing, the
// Save / Cancel buttons live in the sticky bar (`formId` links them to this form),
// so `actions` is false there.
function CriterionForm({ initial, submitLabel, busy, onSubmit, formId, actions = true, submitVariant = "primary" }) {
  const [form, setForm] = useState(initial)
  const idPrefix = initial.id ? `edit-${initial.id}` : "new"

  return (
    <form
      id={formId}
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
        <Label htmlFor={`${idPrefix}-name`} className="text-xs font-normal text-muted">
          Question shown to the observer
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          maxLength={200}
          required
          className="mt-1"
          placeholder="Clarity of communication"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-weight`} className="text-xs font-normal text-muted">
          Weight
        </Label>
        <Input
          id={`${idPrefix}-weight`}
          type="number"
          min="0"
          step="0.5"
          value={form.weight}
          onChange={(event) => setForm({ ...form, weight: event.target.value })}
          required
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-description`} className="text-xs font-normal text-muted">
          Guidance for the observer (optional)
        </Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          maxLength={2000}
          rows={2}
          className="mt-1"
          placeholder="What a high or a low rating means for this question."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        {actions && (
          <Button type="submit" variant={submitVariant} disabled={busy || !form.name.trim()}>
            {submitLabel}
          </Button>
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
  const toast = useToast()
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
  const [deleting, setDeleting] = useState(null) // the criterion waiting for a delete confirm

  const run = async (action, message) => {
    setBusy(true)
    setActionError("")
    setNotice("")
    try {
      await action()
      if (message) {
        setNotice(message)
        toast.success(message)
      }
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

  const confirmRemove = () => {
    const criterion = deleting
    setDeleting(null)
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

  const editing = criteria.find((criterion) => criterion.id === editingId)

  return (
    <div className="space-y-6">
      {actionError && (
        <Callout tone="danger" role="alert">
          {actionError}
        </Callout>
      )}
      {!actionError && notice && <Callout tone="success">{notice}</Callout>}

      <Card padded={false}>
        <CardHeader
          title={`Questions on the form (${active.length} active)`}
          description="Observers answer these in this order using a 1–5 rating scale."
          action={
            active.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPreview((current) => !current)}
                aria-expanded={showPreview}
                className="rounded-sm text-sm font-medium text-primary hover:underline"
              >
                {showPreview ? "Hide preview" : "Preview as the observer"}
              </button>
            )
          }
        />
        <CardBody className="pb-6">
          {showPreview && active.length > 0 && (
            <div className="mb-4 rounded-card border border-dashed border-primary/40 p-5">
              <p className="mb-4 text-sm text-muted">
                This is the form an observer fills in after the class. Nothing here is saved.
              </p>
              <ObservationFeedback criteria={active} preview />
            </div>
          )}

          <StateBlock loading={loading} error={error} onRetry={reload} skeleton="table">
            {data &&
              (criteria.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  titleAs="p"
                  title="No questions yet"
                  text="Add the first one below."
                />
              ) : (
                <TableCard>
                  <Table minWidth="44rem">
                    <thead>
                      <tr>
                        <Th>Question</Th>
                        <Th>Scale</Th>
                        <Th>Weight</Th>
                        <Th>
                          <span className="sr-only">Actions</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((criterion) =>
                        editingId === criterion.id ? (
                          <tr key={criterion.id} className="border-b border-line bg-surface-2 last:border-0">
                            <td colSpan={4} className="px-4 py-4">
                              <CriterionForm
                                formId={EDIT_FORM_ID}
                                actions={false}
                                initial={{
                                  id: criterion.id,
                                  name: criterion.name,
                                  description: criterion.description ?? "",
                                  maxScore: criterion.maxScore,
                                  weight: criterion.weight,
                                }}
                                busy={busy}
                                onSubmit={(body) => update(criterion, body)}
                              />
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={criterion.id}
                            className={`border-b border-line last:border-0 ${
                              criterion.isActive ? "" : "bg-surface-2 text-muted"
                            }`}
                          >
                            <Td>
                              <span className="font-medium">{criterion.name}</span>
                              {!criterion.isActive && (
                                <Badge size="sm" className="ml-2">
                                  Off the form
                                </Badge>
                              )}
                              {criterion.description && (
                                <span className="mt-0.5 block text-xs text-muted">{criterion.description}</span>
                              )}
                            </Td>
                            <Td className="whitespace-nowrap">
                              <span className="flex items-center gap-2">
                                <ScaleMeter max={5} />
                                <span className="text-xs text-muted">1–5</span>
                              </span>
                            </Td>
                            <Td>{criterion.weight}</Td>
                            <Td className="whitespace-nowrap text-right">
                              <span className="inline-flex flex-wrap items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingId(criterion.id)
                                    setActionError("")
                                    setNotice("")
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggleActive(criterion)}>
                                  {criterion.isActive ? "Take off form" : "Put back on form"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => setDeleting(criterion)}
                                  className="ml-3 text-danger! hover:bg-danger-soft"
                                >
                                  Delete
                                </Button>
                              </span>
                            </Td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </Table>
                </TableCard>
              ))}
          </StateBlock>
        </CardBody>
      </Card>

      <Card padded={false}>
        <CardHeader
          title="Add a question"
          description="New questions appear at the end of the form, for observations not yet signed."
        />
        <CardBody className="pb-6">
          <CriterionForm
            key={addKey}
            initial={EMPTY}
            submitLabel="Add question"
            submitVariant={editing ? "secondary" : "primary"}
            busy={busy}
            onSubmit={add}
          />
        </CardBody>
      </Card>

      {editing && (
        <StickyActionBar back={{ label: "Cancel", onClick: () => setEditingId(null) }}>
          <Button type="submit" form={EDIT_FORM_ID} loading={busy}>
            Save changes
          </Button>
        </StickyActionBar>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={deleting ? `Delete "${deleting.name}"?` : "Delete question?"}
        description="This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmRemove}
      />
    </div>
  )
}

export default CriteriaManager
