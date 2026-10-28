import { useRef } from "react"
import { cx } from "./cx"

const tabId = (prefix, id) => `${prefix}-tab-${id}`
const panelId = (prefix, id) => `${prefix}-panel-${id}`

// Keyboard: Left/Right move between tabs (wrapping), Home/End jump to the first
// or last. Only the active tab is in the Tab order (roving tabindex), and moving
// selects it, so arrows and the panel stay in sync. The active tab gets an orange
// underline. `idPrefix` must be unique per Tabs on the page.
export function Tabs({ tabs, value, onChange, ariaLabel, idPrefix = "tabs", className }) {
  const refs = useRef({})

  const select = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    onChange(tab.id)
    refs.current[tab.id]?.focus()
  }

  const handleKeyDown = (event, index) => {
    const moves = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    select(moves[event.key])
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        "flex gap-6 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cx(
              "relative -mb-px whitespace-nowrap py-2.5 text-sm font-medium focus-visible:-outline-offset-2",
              "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full",
              selected ? "text-ink after:bg-accent-ink" : "text-muted after:bg-transparent hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Renders only the active panel. Focusable so keyboard users can reach content
// that has no focusable control of its own.
export function TabPanel({ id, value, idPrefix = "tabs", className, children }) {
  if (id !== value) return null
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}
