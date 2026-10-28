import { cx } from "./cx"

// Shared form-control look, tokens only. Use with a Label whose htmlFor matches
// the control's id. `invalid` sets aria-invalid (and the danger border); point
// `aria-describedby` at a HelpText / ErrorText id so screen readers read them.
// Controls fill their container unless the caller sets a width (w-auto, w-48, ...).
const fill = (className) => (/(^|\s)w-/.test(className ?? "") ? "" : "w-full")

const CONTROL =
  "rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted " +
  "transition-[border-color] hover:border-ink focus-visible:border-primary " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger"

export function Label({ className, children, ...rest }) {
  return (
    <label className={cx("block text-sm font-medium text-ink", className)} {...rest}>
      {children}
    </label>
  )
}

export function Input({ invalid = false, className, ref, ...rest }) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, fill(className), "h-10", className)}
      {...rest}
    />
  )
}

export function Select({ invalid = false, className, children, ref, ...rest }) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, fill(className), "h-10 pr-8", className)}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Textarea({ invalid = false, className, ref, ...rest }) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, fill(className), "min-h-24 py-2", className)}
      {...rest}
    />
  )
}

export function HelpText({ className, children, ...rest }) {
  return (
    <p className={cx("mt-1.5 text-sm text-muted", className)} {...rest}>
      {children}
    </p>
  )
}

export function ErrorText({ className, children, ...rest }) {
  return (
    <p role="alert" className={cx("mt-1.5 text-sm text-danger", className)} {...rest}>
      {children}
    </p>
  )
}
