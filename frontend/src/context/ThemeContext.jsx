import { useCallback, useEffect, useMemo, useState } from "react"
import { THEME_STORAGE_KEY, THEME_VALUES, ThemeContext } from "./theme-context"

const DARK_QUERY = "(prefers-color-scheme: dark)"
// The browser toolbar colour; matches --c-brand in index.css.
const BAR_COLOR = { light: "#006b36", dark: "#0b4a2b" }

// Storage can throw (private window, blocked site data), so never trust it.
function readStored() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return THEME_VALUES.includes(value) ? value : "system"
  } catch {
    return "system"
  }
}

function writeStored(value) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // The choice just won't survive a reload.
  }
}

function systemIsDark() {
  return window.matchMedia(DARK_QUERY).matches
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStored)
  const [systemDark, setSystemDark] = useState(systemIsDark)

  // Follow the OS only while the preference is "system". The cleanup removes the
  // listener when the preference changes or the provider unmounts.
  useEffect(() => {
    if (preference !== "system") return undefined
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event) => setSystemDark(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [preference])

  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference

  // Mirror the resolved theme onto <html> (the inline script in index.html did
  // the same before first paint).
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", resolved === "dark")
    root.style.colorScheme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[resolved])
  }, [resolved])

  const setPreference = useCallback((value) => {
    if (!THEME_VALUES.includes(value)) return
    // The OS may have changed while nobody was listening; refresh it here.
    setSystemDark(systemIsDark())
    setPreferenceState(value)
    writeStored(value)
  }, [])

  // light -> dark -> system -> light ...
  const cycle = useCallback(() => {
    setPreference(THEME_VALUES[(THEME_VALUES.indexOf(preference) + 1) % THEME_VALUES.length])
  }, [preference, setPreference])

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
