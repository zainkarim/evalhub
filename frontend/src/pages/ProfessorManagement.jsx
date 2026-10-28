import { useCallback, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import StateBlock from "../components/StateBlock"
import { Button, Callout, Card, Input, Label, PageHeader, Select, StickyActionBar } from "../components/ui"
import { useToast } from "../components/ui/toast-context"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useAuth } from "../context/auth-context"
import { isAC } from "../lib/roles"

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  school: "",
  rank: "assistant_professor",
  isActive: true,
}

function ProfessorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const isEditing = Boolean(id)
  const { user } = useAuth()
  const committee = isAC(user)

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const call = useCallback(
    () => (isEditing ? api.getProfessor(id) : Promise.resolve(null)),
    [id, isEditing],
  )

  const {
    data: professor,
    error: loadError,
    loading,
  } = useApi(call)

  // Fill the form from the loaded professor (editing) or reset it (adding). Done
  // while rendering, when what the form shows no longer matches its source, so
  // there is no extra render with stale values.
  const source = isEditing ? professor : "new"
  const [filledFrom, setFilledFrom] = useState(null)
  if (source && source !== filledFrom) {
    setFilledFrom(source)
    if (isEditing) {
      setForm({
        firstName: professor.firstName ?? "",
        lastName: professor.lastName ?? "",
        email: professor.email ?? "",
        school: professor.school ?? "",
        rank: professor.rank ?? "assistant_professor",
        isActive: professor.isActive ?? true,
      })
    } else {
      setForm(EMPTY_FORM)
      setError("")
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError("")

    try {
      if (isEditing) {
        const updates = committee
          ? form
          : { rank: form.rank }

        await api.updateProfessor(id, updates)
        toast.success("Professor saved.")
        navigate(committee ? `/professors/${id}` : "/observations")
      } else {
        const professor = await api.createProfessor(form)
        toast.success("Professor added.")
        navigate(`/professors/${professor.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Faculty editing their own profile come from, and go back to, Observations.
  const backTo = committee ? (isEditing ? `/professors/${id}` : "/professors") : "/observations"
  // If the professor can't be loaded there is no profile page to go back to.
  const errorBackTo = committee ? "/professors" : "/observations"
  const makeHeader = (to) => (
    <PageHeader
      backTo={{ to, label: "Back" }}
      title={isEditing ? "Edit Professor" : "Add Professor"}
      subtitle={
        isEditing
          ? committee
            ? "Update faculty information."
            : "You can update your rank. The committee manages your other details."
          : "Add a faculty member to the evaluation roster."
      }
    />
  )
  const header = makeHeader(backTo)

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <StateBlock loading skeleton="form" />
      </div>
    )
  }
  if (isEditing && loadError) {
    return (
      <div className="space-y-6">
        {makeHeader(errorBackTo)}
        <Callout tone="danger" role="alert">
          {loadError.message}
        </Callout>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {header}

      <Card className="max-w-2xl space-y-5">
        {error && (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
              disabled={!committee}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
              disabled={!committee}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            disabled={!committee}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="school">School</Label>
          <Input
            id="school"
            type="text"
            name="school"
            value={form.school}
            onChange={handleChange}
            required
            disabled={!committee}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="rank">Rank</Label>
          <Select id="rank" name="rank" value={form.rank} onChange={handleChange} className="mt-1.5">
            <option value="assistant_professor">Assistant Professor</option>
            <option value="associate_professor">Associate Professor</option>
            <option value="full_professor">Full Professor</option>
          </Select>
        </div>

        {isEditing && committee && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="h-4 w-4 accent-primary"
            />
            <span className="font-medium">Active faculty member</span>
          </label>
        )}
      </Card>

      <StickyActionBar back={{ to: backTo, label: "Cancel" }}>
        <Button type="submit" loading={saving}>
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Professor"}
        </Button>
      </StickyActionBar>
    </form>
  )
}

export default ProfessorForm
