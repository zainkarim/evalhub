import { AnimatePresence, m } from "motion/react"
import { Menu, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { NavBadge } from "./MainNav"
import Button from "./ui/Button"
import { useModalDialog } from "./ui/useModalDialog"

// Navigation below `lg`: a hamburger that opens a slide-in panel. The panel is a
// native <dialog> (browser-made focus trap, inert page, Esc) driven by
// useModalDialog, so it stays open until the slide-out finishes.
//
// "Open" is remembered together with the page it was opened on, so changing page
// closes it with no effect and no extra render. It also closes on a link click
// (the current page's link doesn't change the path), and when the window grows
// to desktop width.
function MobileNav({ items, counts, name, role, onSignOut }) {
  const { pathname } = useLocation()
  const [openOn, setOpenOn] = useState(null)
  const open = openOn === pathname
  const buttonRef = useRef(null)
  const closeRef = useRef(null)
  const close = () => setOpenOn(null)
  const { dialogRef, dialogProps, handleExitComplete } = useModalDialog({
    open,
    onRequestClose: close,
    initialFocusRef: closeRef,
    returnFocusRef: buttonRef,
  })

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)")
    const onChange = (event) => {
      if (event.matches) setOpenOn(null)
    }
    desktop.addEventListener("change", onChange)
    return () => desktop.removeEventListener("change", onChange)
  }, [])

  // Keep the page behind from scrolling while the panel is open.
  useEffect(() => {
    if (!open) return undefined
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = "hidden"
    return () => {
      root.style.overflow = previous
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenOn(pathname)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-surface-2"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Main menu"
        className="m-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 text-ink backdrop:bg-transparent open:block"
        {...dialogProps}
      >
        <AnimatePresence onExitComplete={handleExitComplete}>
          {open && (
            <m.div
              key="dim"
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 bg-bg/75 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          )}
          {open && (
            <m.div
              key="panel"
              className="fixed inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-r border-line bg-surface shadow-lg"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
                <span className="text-sm font-semibold text-muted">Menu</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-surface-2"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label="Main menu links" className="flex-1 p-3">
                <ul className="space-y-1">
                  {items.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        onClick={close}
                        className={({ isActive }) =>
                          `relative flex items-center justify-between gap-3 rounded-md px-3 py-3 text-base ${
                            isActive
                              ? "font-medium text-ink before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
                              : "text-muted hover:bg-surface-2 hover:text-ink"
                          }`
                        }
                      >
                        {link.label}
                        <NavBadge count={counts[link.badge] ?? 0} />
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="shrink-0 border-t border-line p-4">
                <p className="truncate font-medium">{name}</p>
                {role && <p className="mt-0.5 text-sm text-muted">{role}</p>}
                <Button variant="secondary" fullWidth className="mt-4" onClick={onSignOut}>
                  Sign out
                </Button>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </dialog>
    </div>
  )
}

export default MobileNav
