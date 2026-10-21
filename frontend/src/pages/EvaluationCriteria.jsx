import CriteriaManager from "../components/CriteriaManager"

// Committee page: the observation form template (#33, requirements §4.4–4.5).
function EvaluationCriteria() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Evaluation criteria</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        The questions on the observation form. Observers rate each one and add notes, but
        can&apos;t change the questions. A question that has been answered in an observation
        can&apos;t be deleted; take it off the form instead, and the records that used it keep it.
      </p>
      <div className="mt-8">
        <CriteriaManager />
      </div>
    </div>
  )
}

export default EvaluationCriteria
