// Stand-in for the backend until Sprint 1 APIs land.
// Shapes here are the contract the real API is expected to match.

export const professors = [
  {
    id: 1,
    firstName: "Anita",
    lastName: "Rao",
    email: "anita.rao@utdallas.edu",
    school: "ECS",
    rank: "Assistant Professor",
    focusAreas: ["Systems", "Operating Systems"],
    lastEvaluated: null,
    active: true,
  },
  {
    id: 2,
    firstName: "Daniel",
    lastName: "Okafor",
    email: "daniel.okafor@utdallas.edu",
    school: "ECS",
    rank: "Associate Professor",
    focusAreas: ["Algorithms", "Theory"],
    lastEvaluated: "2025-04-18",
    active: true,
  },
  {
    id: 3,
    firstName: "Maria",
    lastName: "Delgado",
    email: "maria.delgado@utdallas.edu",
    school: "ECS",
    rank: "Full Professor",
    focusAreas: ["Databases"],
    lastEvaluated: "2024-11-02",
    active: true,
  },
  {
    id: 4,
    firstName: "Kevin",
    lastName: "Shah",
    email: "kevin.shah@utdallas.edu",
    school: "ECS",
    rank: "Assistant Professor",
    focusAreas: ["Machine Learning"],
    lastEvaluated: "2025-10-09",
    active: true,
  },
  {
    id: 5,
    firstName: "Grace",
    lastName: "Lindqvist",
    email: "grace.lindqvist@utdallas.edu",
    school: "ECS",
    rank: "Associate Professor",
    focusAreas: ["Software Engineering"],
    lastEvaluated: "2023-03-21",
    active: false,
  },
]

export const courses = [
  {
    id: 101,
    courseNumber: "CS 4348",
    title: "Operating Systems Concepts",
    term: "Fall 2026",
    section: "001",
    focusArea: "Systems",
    creditHours: 3,
    enrolled: 118,
    capacity: 120,
    schedule: {
      days: "Tue, Thu",
      startTime: "10:00",
      endTime: "11:15",
      location: "ECSS 2.410",
    },
    instructor: { id: 1, name: "Anita Rao" },
    pastInstructors: [
      { term: "Spring 2026", name: "Anita Rao" },
      { term: "Fall 2025", name: "Grace Lindqvist" },
      { term: "Spring 2025", name: "Anita Rao" },
    ],
  },
  {
    id: 102,
    courseNumber: "CS 4384",
    title: "Automata Theory",
    term: "Fall 2026",
    section: "002",
    focusArea: "Theory",
    creditHours: 3,
    enrolled: 94,
    capacity: 100,
    schedule: {
      days: "Mon, Wed",
      startTime: "13:00",
      endTime: "14:15",
      location: "ECSW 1.315",
    },
    instructor: { id: 2, name: "Daniel Okafor" },
    pastInstructors: [
      { term: "Spring 2026", name: "Daniel Okafor" },
      { term: "Fall 2025", name: "Daniel Okafor" },
    ],
  },
  {
    id: 103,
    courseNumber: "CS 6360",
    title: "Database Design",
    term: "Fall 2026",
    section: "001",
    focusArea: "Databases",
    creditHours: 3,
    enrolled: 76,
    capacity: 90,
    schedule: {
      days: "Wed",
      startTime: "17:30",
      endTime: "20:15",
      location: "ECSS 2.203",
    },
    instructor: { id: 3, name: "Maria Delgado" },
    pastInstructors: [
      { term: "Fall 2025", name: "Maria Delgado" },
      { term: "Fall 2024", name: "Maria Delgado" },
    ],
  },
  {
    id: 104,
    courseNumber: "CS 4375",
    title: "Introduction to Machine Learning",
    term: "Fall 2026",
    section: "003",
    focusArea: "Machine Learning",
    creditHours: 3,
    enrolled: 131,
    capacity: 135,
    schedule: {
      days: "Tue, Thu",
      startTime: "14:30",
      endTime: "15:45",
      location: "JO 3.516",
    },
    instructor: { id: 4, name: "Kevin Shah" },
    pastInstructors: [{ term: "Spring 2026", name: "Kevin Shah" }],
  },
  {
    id: 105,
    courseNumber: "SE 3354",
    title: "Software Engineering",
    term: "Spring 2026",
    section: "001",
    focusArea: "Software Engineering",
    creditHours: 3,
    enrolled: 88,
    capacity: 100,
    schedule: {
      days: "Mon, Wed",
      startTime: "10:00",
      endTime: "11:15",
      location: "ECSS 2.412",
    },
    instructor: { id: 5, name: "Grace Lindqvist" },
    pastInstructors: [{ term: "Spring 2025", name: "Grace Lindqvist" }],
  },
  {
    id: 106,
    courseNumber: "CS 3345",
    title: "Data Structures and Algorithmic Analysis",
    term: "Spring 2026",
    section: "004",
    focusArea: "Algorithms",
    creditHours: 3,
    enrolled: 142,
    capacity: 150,
    schedule: {
      days: "Tue, Thu",
      startTime: "08:30",
      endTime: "09:45",
      location: "ECSW 1.365",
    },
    instructor: { id: 2, name: "Daniel Okafor" },
    pastInstructors: [
      { term: "Fall 2025", name: "Daniel Okafor" },
      { term: "Spring 2025", name: "Anita Rao" },
    ],
  },
]

const accounts = [
  {
    password: "acdemo",
    user: {
      id: 900,
      name: "Priya Menon",
      email: "ac@utdallas.edu",
      role: "AC",
    },
  },
  {
    password: "facdemo",
    user: {
      id: 1,
      name: "Anita Rao",
      email: "anita.rao@utdallas.edu",
      role: "FACULTY",
    },
  },
]

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

function fail(message, status) {
  const error = new Error(message)
  error.name = "ApiError"
  error.status = status
  return error
}

function decode(token) {
  try {
    return JSON.parse(atob(token.replace("mock.", "")))
  } catch {
    return null
  }
}

export async function mockRequest(path, { method = "GET", body, token } = {}) {
  await wait()
  const [route, search] = path.split("?")
  const params = new URLSearchParams(search)

  if (route === "/auth/login" && method === "POST") {
    const email = body?.email?.trim().toLowerCase()
    const match = accounts.find(
      (account) =>
        account.user.email === email && account.password === body?.password,
    )
    if (!match) throw fail("Email or password is incorrect.", 401)
    return { token: `mock.${btoa(JSON.stringify(match.user))}`, user: match.user }
  }

  const user = token ? decode(token) : null
  if (!user) throw fail("Your session ended. Sign in again.", 401)

  if (route === "/auth/me") return user

  if (route === "/professors") return professors
  if (route.startsWith("/professors/")) {
    const id = Number(route.split("/")[2])
    const professor = professors.find((item) => item.id === id)
    if (!professor) throw fail("Professor not found.", 404)
    return professor
  }

  if (route === "/courses") {
    const term = params.get("term")
    const search = params.get("search")?.toLowerCase()
    return courses.filter((course) => {
      if (term && course.term !== term) return false
      if (
        search &&
        !`${course.courseNumber} ${course.title} ${course.instructor.name}`
          .toLowerCase()
          .includes(search)
      )
        return false
      return true
    })
  }
  if (route.startsWith("/courses/")) {
    const id = Number(route.split("/")[2])
    const course = courses.find((item) => item.id === id)
    if (!course) throw fail("Course not found.", 404)
    return course
  }

  throw fail(`No mock handler for ${method} ${route}.`, 404)
}
