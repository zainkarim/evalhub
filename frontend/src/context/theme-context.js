import { createContext, useContext } from "react"

// Shared with the inline script in index.html (it can't import modules, so it
// repeats these two values; keep them in sync).
export const THEME_STORAGE_KEY = "evalhub-theme"
export const THEME_VALUES = ["light", "dark", "system"]

export const ThemeContext = createContext(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>")
  return context
}
