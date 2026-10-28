// Role helpers. Backend roles are `faculty`, `ac_member` and `admin`
// (see backend/docs/api-contract.md). AC and admin share the committee views.

export const AC_ROLES = ["ac_member", "admin"]

export const isAC = (user) => AC_ROLES.includes(user?.role)

export const isFaculty = (user) => user?.role === "faculty"

// Committee members are usually professors too, so they can take part in the
// process as observee/observer. Admin accounts have no teacher profile.
export const hasTeacherProfile = (user) => Boolean(user?.teacherId)

export function roleLabel(user) {
  if (user?.role === "ac_member") return "Assessment Committee"
  if (user?.role === "admin") return "Administrator"
  if (user?.role === "faculty") return "Faculty"
  return ""
}

export function displayName(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ")
  return name || user?.email || ""
}
