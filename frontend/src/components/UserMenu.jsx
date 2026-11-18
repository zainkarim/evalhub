import { useEffect, useId, useRef, useState } from "react"
import { NavLink } from "react-router-dom"
import Button from "./ui/Button"

// Avatar initials that open a small panel: who you are, your role, your own
// pages (`links`, e.g. My Requests), Sign out. It is a disclosure (a button that
// shows a panel), not an ARIA menu: a few plain links and one action, so menu
// keyboard rules would only get in the way. Esc closes
// and returns focus to the button; a click or focus outside closes it.
// (focusin, not blur: Safari doesn't focus a button on click, so blur would
// close the panel before the Sign out click lands.)
function UserMenu({ name, role, initials, links = [], onSignOut }) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef(null)
  const trigger = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return undefined
    const outside = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener("mousedown", outside)
    document.addEventListener("focusin", outside)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", outside)
      document.removeEventListener("focusin", outside)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Account menu, ${name}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink ring-1 ring-line hover:ring-ink"
      >
        <span aria-hidden="true">{initials}</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-surface p-4 text-ink shadow-lg"
        >
          <p className="truncate font-medium">{name}</p>
          {role && <p className="mt-0.5 text-sm text-muted">{role}</p>}
          {links.length > 0 && (
            <ul className="mt-3 border-t border-line pt-2">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `-mx-2 block rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${
                        isActive ? "font-medium text-ink" : "text-muted hover:text-ink"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" size="sm" fullWidth className="mt-4" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
