import { Monitor, Moon, Sun } from "lucide-react"
import { THEME_VALUES, useTheme } from "../context/theme-context"

const LABELS = { light: "light", dark: "dark", system: "system" }
const ICONS = { light: Sun, dark: Moon, system: Monitor }

// One icon button that cycles light -> dark -> system. Sized for the green brand
// bar (white on low opacity), 36px square so it fits at 390px.
function ThemeToggle() {
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/30 text-white/90 hover:bg-white/10 hover:text-white"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  )
}

export default ThemeToggle
