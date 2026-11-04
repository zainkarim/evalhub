import { api } from "./api"

export async function loadObservationActivity(teacherId) {
  const [assessments, incoming, observations] = await Promise.all([
    api.myAssessments(),
        // GET /time-options/incoming isn't on the real backend yet (#74); treat 404 as no requests.
    api.incomingRequests().catch((err) => {
      if (err.status === 404) return { data: [] }
      throw err
    }),
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