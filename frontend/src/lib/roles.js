// Role helpers. Backend roles are `faculty`, `ac_member`, `admin`, and the two
// view-only roles `dept_head` and `annual_review` (#126). AC and admin share the
// committee views.

export const AC_ROLES = ["ac_member", "admin"]

export const isAC = (user) => AC_ROLES.includes(user?.role)

export const isFaculty = (user) => user?.role === "faculty"

// Department Head and Annual Review Committee: read-only access to completed
// observations, nothing else (requirements §3, §4.6). No teacher profile.
export const VIEW_ONLY_ROLES = ["dept_head", "annual_review"]

export const isViewOnly = (user) => VIEW_ONLY_ROLES.includes(user?.role)

// Committee members are usually professors too, so they can take part in the
// process as observee/observer. Admin accounts have no teacher profile.
export const hasTeacherProfile = (user) => Boolean(user?.teacherId)

export function roleLabel(user) {
  if (user?.role === "ac_member") return "Assessment Committee"
  if (user?.role === "admin") return "Administrator"
  if (user?.role === "faculty") return "Faculty"
  if (user?.role === "dept_head") return "Department Head"
  if (user?.role === "annual_review") return "Annual Review Committee"
  return ""
}

export function displayName(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ")
  return name || user?.email || ""
}
