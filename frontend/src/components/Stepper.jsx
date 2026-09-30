import { currentStep, STEPS } from "../lib/workflow"

// Where a sign-up is in the process: sign-up → choose observer → committee
// approval → observation → sign-off.
function Stepper({ assessment }) {
  const current = currentStep(assessment)
  if (current < 0) return null

  return (
    <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Progress">
      {STEPS.map((label, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={label} aria-current={active ? "step" : undefined}>
            <div
              className={`h-1.5 rounded ${
                done ? "bg-utd-green" : active ? "bg-utd-orange" : "bg-line"
              }`}
            />
            <p
              className={`mt-2 text-xs ${
                active ? "font-semibold text-ink" : done ? "text-ink" : "text-muted"
              }`}
            >
              {done ? "✓ " : ""}
              {label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

export default Stepper
