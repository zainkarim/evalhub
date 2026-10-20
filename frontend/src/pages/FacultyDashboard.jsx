import { Link } from "react-router-dom"
import StatusBadge from "../components/StatusBadge"
import {
    OBSERVATION_STATUS,
    courseLabel,
    formatDate,
    fullName,
    toDateOnly,
} from "../lib/format"
import { useCallback, useState } from "react"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useAuth } from "../context/auth-context"
import { hasTeacherProfile } from "../lib/roles"


function ObservationRows({ rows, view }) {
    if (rows.length === 0) {
        return <p className="text-sm text-muted">No observations yet.</p>
    }

    return (
        <div className="relative overflow-x-auto rounded border border-line bg-white">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs text-muted">
                    <tr>
                        <th className="p-3">Course</th>
                        <th className="p-3">
                            {view === "observer" ? "Observing" : "Observer"}
                        </th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Open</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((observation) => (
                        <tr key={observation.id} className="border-t border-line">
                            <td className="p-3">
                                {observation.section?.course
                                    ? courseLabel(observation.section.course)
                                    : "—"}
                            </td>
                            <td className="p-3">
                                {fullName(
                                    view === "observer"
                                        ? observation.observee
                                        : observation.observer
                                )}
                            </td>
                            <td className="p-3">
                                {formatDate(observation.scheduledDate)}
                            </td>
                            <td className="p-3">
                                <StatusBadge
                                    status={observation.status}
                                    map={OBSERVATION_STATUS}
                                />
                            </td>
                            <td className="p-3">
                                <Link
                                    to={`/records/${observation.id}`}
                                    className="text-blue-600 hover:underline"
                                >
                                    View
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default function FacultyDashboard() {
    const [view, setView] = useState("observee")
    const { user } = useAuth()
    const hasProfile = hasTeacherProfile(user)

    const loadDashboard = useCallback(async () => {
        if (!hasProfile) {
            return {
                observations: [],
                assessments: [],
                incoming: [],
            }
        }

        const [observations, assessments, incoming] = await Promise.all([
            api.listObservations(),
            api.myAssessments(),
            api.incomingRequests(),
        ])

        return {
            observations: observations.data ?? [],
            assessments: assessments.data ?? [],
            incoming: incoming.data ?? [],
        }
    }, [hasProfile])

    const { data, error, loading } = useApi(loadDashboard)

    const observations = data?.observations ?? []

    const pendingRequests =
        view === "observer"
            ? (data?.incoming ?? []).filter((item) => item.status === "pending")
            : (data?.assessments ?? []).filter(
                (item) => item.offer?.status === "pending"
            )


    const mine = hasProfile
        ? observations.filter((item) =>
            view === "observer"
                ? item.observer?.id === user.teacherId
                : item.observee?.id === user.teacherId
        )
        : []

    const today = toDateOnly(new Date().toLocaleDateString("en-CA"))

    const upcoming = mine.filter(
        (item) =>
            item.status === "approved" &&
            toDateOnly(item.scheduledDate) >= today
    )

    const completed = mine.filter((item) => item.status === "completed")

    const postponed = mine.filter(
        (item) => item.status === "postponed"
    )

    const needsSignOff = mine.filter(
        (item) =>
            item.status === "approved" &&
            toDateOnly(item.scheduledDate) < today
    )

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
                {loading ? (
                    <p>Loading observations...</p>
                ) : error ? (
                    <p role="alert" className="text-red-600">{error.message}</p>
                ) : (
                    <ObservationRows rows={upcoming} view={view} />
                )}
            </section>
            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Needs Sign-off
                </h2>
                {loading ? (
                    <p>Loading observations...</p>
                ) : error ? (
                    <p role="alert" className="text-red-600">
                        {error.message}
                    </p>
                ) : (
                    <ObservationRows rows={needsSignOff} view={view} />
                )}
            </section>

            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Postponed Observations
                </h2>
                {loading ? (
                    <p>Loading observations...</p>
                ) : error ? (
                    <p role="alert" className="text-red-600">
                        {error.message}
                    </p>
                ) : (
                    <ObservationRows rows={postponed} view={view} />
                )}
            </section>

            <section className="mt-8">
                <h2 className="mb-4 text-lg font-semibold">
                    Pending Requests
                </h2>

                {loading ? (
                    <p>Loading requests...</p>
                ) : error ? (
                    <p role="alert" className="text-red-600">
                        {error.message}
                    </p>
                ) : pendingRequests.length === 0 ? (
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
                                        to="/observations"
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
                {loading ? (
                    <p>Loading observations...</p>
                ) : error ? (
                    <p role="alert" className="text-red-600">{error.message}</p>
                ) : (
                    <ObservationRows rows={completed} view={view} />
                )}
            </section>
        </div>
    )
}