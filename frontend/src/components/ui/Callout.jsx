import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { cx } from "./cx"

const TONES = {
  info: { box: "border-info/40 bg-info-soft", icon: Info, color: "text-info" },
  success: { box: "border-success/40 bg-success-soft", icon: CircleCheck, color: "text-success" },
  warning: { box: "border-warning/40 bg-warning-soft", icon: TriangleAlert, color: "text-warning" },
  danger: { box: "border-danger/40 bg-danger-soft", icon: CircleAlert, color: "text-danger" },
}

// A message inside the page: an icon, an optional title and the text. Use
// role="alert" for errors that just happened (screen readers read it out) and
// no role for messages that are simply part of the page. `action` is one Button.
function Callout({ tone = "info", title, action, className, children, ...rest }) {
  const { box, icon: Icon, color } = TONES[tone] ?? TONES.info
  return (
    <div
      className={cx("flex items-start gap-3 rounded-card border px-4 py-3 text-sm text-ink", box, className)}
      {...rest}
    >
      <Icon aria-hidden="true" className={cx("mt-0.5 h-4 w-4 shrink-0", color)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title && "mt-0.5 text-muted")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export default Callout
