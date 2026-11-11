// Dev / demo mode only. Imported by DevQuickLogin and nothing else, and that
// component is only loaded when import.meta.env.DEV or the mock API is in use,
// so a build for the real backend contains none of this.
export const DEV_PASSWORD = "ChangeMe-Dev-123!"

// `mockOnly` accounts exist only in the in-browser mock data.
export const DEV_GROUPS = [
  {
    title: "Assessment Committee",
    accounts: [
      {
        email: "ac@example.edu",
        label: "Professor B",
        note: "Runs the cycle, starts observer selection, sends reminders",
      },
    ],
  },
  {
    title: "Faculty",
    accounts: [
      {
        email: "faculty@example.edu",
        label: "Professor C",
        note: "Observee: signs up, then picks one observer and dates",
      },
      {
        email: "professor.h@example.edu",
        label: "Professor H",
        note: "Observer: confirms one of the offered dates",
        mockOnly: true,
      },
      {
        email: "professor.e@example.edu",
        label: "Professor E",
        note: "CS 3354 has 6 eligible observers",
        mockOnly: true,
      },
    ],
  },
  {
    title: "Administrator",
    accounts: [
      {
        email: "admin@example.edu",
        label: "Administrator",
        note: "Committee view, no teaching profile",
      },
    ],
  },
]
