import { Link } from "react-router-dom"
import ObservationRows from "../components/ObservationRows"
import StateBlock from "../components/StateBlock"
import {
    courseLabel,
    fullName,
    toDateOnly,
} from "../lib/format"
import { useCallback, useState } from "react"
import { useApi } from "../lib/useApi"
import { useAuth } from "../context/auth-context"
import { hasTeacherProfile } from "../lib/roles"
import { loadObservationActivity } from "../lib/observationActivity"



export default function FacultyDashboard() {
    const [view, setView] = useState("observee")
    const { user } = useAuth()
    const hasProfile = hasTeacherProfile(user)

    const loadDashboard = useCallback(
        () =>
            hasProfile
                ? loadObservationActivity(user.teacherId)
                : Promise.resolve({
                    signUps: [],
                    incoming: [],
                    given: [],
                    received: [],
                }),
        [hasProfile, user.teacherId]
    )

    const { data, error, loading, reload } = useApi(loadDashboard)

    const observations =
        view === "observer"
            ? (data?.given ?? [])
            : (data?.received ?? [])

    const pendingRequests =
        view === "observer"
            ? (data?.incoming ?? []).filter((item) => item.status === "pending")
            : (data?.signUps ?? []).filter(
                (item) => item.offer?.status === "pending"
            )


    const mine = observations

    const today = toDateOnly(new Date().toLocaleDateString("en-CA"))

    const upcoming = mine
        .filter(
            (item) =>
                item.status === "approved" &&
                toDateOnly(item.scheduledDate) >= today
        )
        .sort((a, b) =>
            toDateOnly(a.scheduledDate).localeCompare(toDateOnly(b.scheduledDate))
        )

    const completed = mine.filter((item) => item.status === "completed")

    const postponed = mine.filter(
        (item) => item.status === "postponed"
    )

    const needsSignOff = mine.filter(
        (item) =>
            item.status === "approved" &&
            toDateOnly(item.scheduledDate) < today &&
            (view === "observer"
                ? !item.observerSignedOffAt
                : !item.observeeSignedOffAt)
    )

    if (loading || error) {
        return (
            <div>
                <h1 className="mb-6 text-2xl font-semibold">
                    Faculty Observation Dashboard
                </h1>
                <StateBlock
                    loading={loading}
                    error={error}
                    onRetry={reload}
                />
            </div>
        )
    }

    return (
        <div>
            <h1 className="text-2xl font-semibold">
                Faculty Observation Dashboard
            </h1>
            {!hasProfile && (
                <p role="alert" className="mt-4 text-sm text-muted">
                    A teacher profile is required to view faculty observations.
                </p>
            )}



            <div className="mt-6 flex gap-2">
                <button
                    type="button"
                    onClick={() => setView("observee")}
                    className={`rounded px-4 py-2 ${view === "observee"
                        ? "bg-blue-600 text-white"
                        : "border border-line bg-white"
                        }`}
                >
                    Observee
                </button>

                <button
                    type="button"
                    onClick={() => setView("observer")}
                    className={`rounded px-4 py-2 ${view === "observer"
                        ? "bg-blue-600 text-white"
                        : "border border-line bg-white"
                        }`}
                >
                    Observer
                </button>
            </div>


            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Upcoming Confirmed Observations
                </h2>
                <ObservationRows rows={upcoming} view={view} />
            </section>
            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Needs Sign-off
                </h2>
                <ObservationRows rows={needsSignOff} view={view} />
            </section>

            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Postponed Observations
                </h2>
                <ObservationRows rows={postponed} view={view} />
            </section>

            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Pending Requests
                </h2>

                {pendingRequests.length === 0 ? (
                    <p className="text-sm text-muted">
                        No pending requests.
                    </p>
                ) : (
                    <div className="rounded border border-line bg-white">
                        {pendingRequests.map((request) => {
                            const offer = view === "observer" ? request : request.offer

                            return (
                                <div
                                    key={offer.id}
                                    className="flex items-center justify-between gap-4 border-b border-line p-4 last:border-b-0"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {request.section?.course
                                                ? courseLabel(request.section.course)
                                                : "Observation request"}
                                        </p>
                                        <p className="text-sm text-muted">
                                            {view === "observer"
                                                ? `From: ${fullName(request.observee)}`
                                                : `To: ${fullName(offer.observer)}`}
                                        </p>
                                        <p className="text-sm text-muted">
                                            Status: Pending
                                        </p>
                                    </div>

                                    <Link
                                        to={`/assessments/${view === "observer" ? request.assessmentId : request.id}`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        View
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Completed Observations
                </h2>
                <ObservationRows rows={completed} view={view} />
            </section>
        </div>
    )
}