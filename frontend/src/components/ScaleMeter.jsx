// A small horizontal meter for a 1..max rating scale. With `value`, the first
// `value` steps are filled (a recorded rating); without it, the steps are only
// outlined (what the scale looks like).
function ScaleMeter({ max, value, label }) {
  const steps = Array.from({ length: max }, (_, index) => index + 1)
  return (
    <span
      role="img"
      aria-label={label ?? (value ? `${value} out of ${max}` : `Scale of 1 to ${max}`)}
      className="inline-flex items-center gap-0.5"
    >
      {steps.map((step) => (
        <span
          key={step}
          className={`h-2 w-3 rounded-sm ${
            value && step <= value ? "bg-primary-ink" : value ? "bg-line" : "bg-primary-ink/25"
          }`}
        />
      ))}
    </span>
  )
}

export default ScaleMeter
