import { Card } from "../ui"

// One feature on the landing page: an icon in a soft circle, a title, a sentence.
function FeatureCard({ icon: Icon, title, children }) {
  return (
    <Card className="h-full">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-primary"
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{children}</p>
    </Card>
  )
}

export default FeatureCard
