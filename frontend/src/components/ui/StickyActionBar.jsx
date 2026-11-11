import { ArrowLeft } from "lucide-react"
import { useEffect, useRef } from "react"
import Button from "./Button"
import { cx } from "./cx"

// How many bars are mounted, so --sticky-bar-h is removed only when the last one
// goes away.
let mountedBars = 0

// Bottom bar for long forms: Back on the left, Cancel + one Save on the right.
// It sticks to the bottom of the screen while the form is on screen, and pads for
// the phone's home indicator. While mounted it publishes its height as
// --sticky-bar-h on <html> (and removes it when unmounted), so the toast stack
// can sit above it. `offsetToasts={false}` is for demos that aren't at the
// bottom of the page.
function StickyActionBar({ back, offsetToasts = true, className, children }) {
  const barRef = useRef(null)

  useEffect(() => {
    const bar = barRef.current
    if (!offsetToasts || !bar) return undefined
    const root = document.documentElement
    const publish = () => root.style.setProperty("--sticky-bar-h", `${bar.offsetHeight}px`)
    mountedBars += 1
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      mountedBars -= 1
      if (mountedBars === 0) root.style.removeProperty("--sticky-bar-h")
    }
  }, [offsetToasts])

  return (
    <div
      ref={barRef}
      className={cx(
        "sticky bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_-6px_rgb(var(--shadow-rgb)/0.15)] sm:px-6",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        {back ? (
          <Button variant="ghost" size="sm" icon={ArrowLeft} to={back.to} onClick={back.onClick}>
            {back.label ?? "Back"}
          </Button>
        ) : (
          <span />
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
      </div>
    </div>
  )
}

export default StickyActionBar
