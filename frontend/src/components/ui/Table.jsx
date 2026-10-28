import { cx } from "./cx"

// A data table in a card. The card scrolls sideways on its own (with edge
// shadows showing there is more), so the page never scrolls sideways; give
// `maxHeight` to also scroll vertically with the header row staying put.
// Numbers line up (tabular-nums) and rows highlight on hover (index.css).
export function TableCard({ maxHeight = false, label = "Table", className, children }) {
  return (
    <div
      // A scrollable area must be reachable by keyboard (arrow keys scroll it).
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cx(
        "scroll-shadow-x relative overflow-auto rounded-card border border-line shadow-xs",
        maxHeight && "max-h-[70vh]",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Table({ minWidth = "40rem", className, children }) {
  return (
    <table className={cx("w-full text-left text-sm tabular-nums", className)} style={{ minWidth }}>
      {children}
    </table>
  )
}

export function Th({ className, children, ...rest }) {
  return (
    <th
      className={cx(
        "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface px-4 py-3 text-xs font-medium text-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ className, children, ...rest }) {
  return (
    <td className={cx("px-4 py-3 align-top", className)} {...rest}>
      {children}
    </td>
  )
}
