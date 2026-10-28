import { Monitor, Moon, Sun } from "lucide-react"
import { THEME_VALUES, useTheme } from "../context/theme-context"

const LABELS = { light: "light", dark: "dark", system: "system" }
const ICONS = { light: Sun, dark: Moon, system: Monitor }

// One icon button that cycles light -> dark -> system. 36px square, so it fits
// next to the bell and the account button at 390px.
function ThemeToggle({ className = "" }) {
  const { preference, cycle } = useTheme()
  const next = THEME_VALUES[(THEME_VALUES.indexOf(preference) + 1) % THEME_VALUES.length]
  const label = `Theme: ${LABELS[preference]}. Click for ${LABELS[next]}`
  const Icon = ICONS[preference]
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink ${className}`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  )
}

export default ThemeToggle
