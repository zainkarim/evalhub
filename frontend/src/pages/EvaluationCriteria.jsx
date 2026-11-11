import CriteriaManager from "../components/CriteriaManager"
import { PageHeader } from "../components/ui"

// Committee page: the observation form template (#33, requirements §4.4–4.5).
function EvaluationCriteria() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Evaluation criteria"
        subtitle="The questions on the observation form. Observers rate each one and add notes, but can't change the questions. A question that has been answered in an observation can't be deleted; take it off the form instead, and the records that used it keep it."
      />
      <CriteriaManager />
    </div>
  )
}

export default EvaluationCriteria
