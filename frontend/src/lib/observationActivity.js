import { api } from "./api"

export async function loadObservationActivity(teacherId) {
  const [assessments, incoming, observations] = await Promise.all([
    api.myAssessments(),
    api.incomingRequests(),
    api.listObservations(),
  ])

  const mine = (observations.data ?? []).filter(
    (item) =>
      item.observer?.id === teacherId ||
      item.observee?.id === teacherId
  )

  return {
    signUps: assessments.data ?? [],
    incoming: incoming.data ?? [],
    given: mine.filter((item) => item.observer?.id === teacherId),
    received: mine.filter((item) => item.observee?.id === teacherId),
  }
}