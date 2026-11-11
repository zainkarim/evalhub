import { ArrowLeft, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import { cx } from "./cx"

// Title and subtitle on the left, one primary action top-right. Below `sm` the
// action drops under the title and fills the width, so it stays easy to tap.
// `backTo` ({ to, label }) is a "back" link; `breadcrumbs` ([{ label, to? }]) is
// the path (give `breadcrumbLabel` a distinct name if a page has two). The last
// breadcrumb is the current page. `titleAs` only changes the
// heading level (gallery demos use h4 so they don't add extra h1s).
function PageHeader({
  title,
  subtitle,
  backTo,
  breadcrumbs,
  breadcrumbLabel = "Breadcrumb",
  action,
  titleAs: Title = "h1",
  className,
}) {
  return (
    <header className={cx("sky-scrim flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length > 0 && (
          <nav aria-label={breadcrumbLabel} className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1
                return (
                  <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {crumb.to && !last ? (
                      <Link to={crumb.to} className="rounded-sm hover:text-ink hover:underline">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={last ? "page" : undefined} className={last ? "text-ink" : undefined}>
                        {crumb.label}
                      </span>
                    )}
                    {!last && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}
        {backTo && (
          <Link
            to={backTo.to}
            className="mb-2 inline-flex items-center gap-1 rounded-sm text-sm text-muted hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {backTo.label ?? "Back"}
          </Link>
        )}
        <Title className="text-2xl font-semibold tracking-tight">{title}</Title>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 max-sm:[&>*]:w-full">{action}</div>}
    </header>
  )
}

export default PageHeader
