import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { api } from "../lib/api"

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
  const isEditing = Boolean(id)

  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isEditing) return

    async function loadProfessor() {
      try {
        const professor = await api.getProfessor(id)

        setForm({
          firstName: professor.firstName ?? "",
          lastName: professor.lastName ?? "",
          email: professor.email ?? "",
          school: professor.school ?? "",
          rank: professor.rank ?? "assistant_professor",
          isActive: professor.isActive ?? true,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadProfessor()
  }, [id, isEditing])

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
        await api.updateProfessor(id, form)
        navigate(`/professors/${id}`)
      } else {
        const professor = await api.createProfessor(form)
        navigate(`/professors/${professor.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading professor...</p>
  }

  return (
    <div className="max-w-2xl">
      <Link
        to={isEditing ? `/professors/${id}` : "/professors"}
        className="text-sm text-muted hover:text-ink"
      >
        Back
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {isEditing ? "Edit Professor" : "Add Professor"}
      </h1>

      <p className="mt-1 text-sm text-muted">
        {isEditing
          ? "Update faculty information."
          : "Add a faculty member to the evaluation roster."}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded border border-line bg-white p-6"
      >
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">First name</span>
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded border border-line px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Last name</span>
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded border border-line px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded border border-line px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">School</span>
          <input
            type="text"
            name="school"
            value={form.school}
            onChange={handleChange}
            required
            className="mt-1 w-full rounded border border-line px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Rank</span>
          <select
            name="rank"
            value={form.rank}
            onChange={handleChange}
            className="mt-1 w-full rounded border border-line px-3 py-2"
          >
            <option value="assistant_professor">Assistant Professor</option>
            <option value="associate_professor">Associate Professor</option>
            <option value="full_professor">Full Professor</option>
          </select>
        </label>

        {isEditing && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
            />
            <span className="font-medium">Active faculty member</span>
          </label>
        )}

        <div className="flex gap-3 border-t border-line pt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-utd-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Add Professor"}
          </button>

          <Link
            to={isEditing ? `/professors/${id}` : "/professors"}
            className="rounded border border-line px-4 py-2 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

export default ProfessorForm