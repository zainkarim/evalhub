import { m } from "motion/react"

const STEPS = [
  { title: "Sign up", text: "Faculty who are due sign up for the term." },
  {
    title: "Pick an observer",
    text: "After the committee starts observer selection, choose one observer and offer 4–8 dates.",
  },
  { title: "Observe", text: "The observer confirms a date and completes the evaluation." },
  { title: "Sign off", text: "Both sign off; the record is completed and locked." },
]

// Four numbered steps: a row on desktop joined by a thin line (with a small comet
// dot that runs along it once), stacked on a phone.
function WorkflowStrip() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute left-5 right-5 top-5 hidden h-px overflow-hidden bg-line md:block"
      >
        <m.span
          className="absolute inset-0"
          initial={{ x: "-100%" }}
          whileInView={{ x: "0%" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
        >
          <span className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent shadow-sm" />
        </m.span>
      </div>
      <ol className="relative grid gap-6 md:grid-cols-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="relative flex gap-4 rounded-card border border-line bg-surface p-5 shadow-xs md:block"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg"
            >
              {index + 1}
            </span>
            <div className="md:mt-4">
              <h3 className="text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default WorkflowStrip
