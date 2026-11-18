import { m } from "motion/react"
import { useEffect, useState } from "react"
import Comet from "./Comet"

// The decorative part of the intro: the big comet and the "press any key" hint.
// It only exists while the intro plays. Any key, click, tap or wheel calls
// onSkip, and the listeners are removed as soon as this unmounts.
function IntroSequence({ onSkip }) {
  const [view] = useState(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    const length = Math.min(900, Math.max(280, width * 0.5))
    return {
      length,
      from: { x: -24, y: height * 0.06 },
      to: { x: width + length + 40, y: height * 0.94 },
      touch: window.matchMedia("(pointer: coarse)").matches,
    }
  })

  useEffect(() => {
    const skip = () => onSkip()
    window.addEventListener("keydown", skip)
    window.addEventListener("pointerdown", skip)
    window.addEventListener("wheel", skip, { passive: true })
    return () => {
      window.removeEventListener("keydown", skip)
      window.removeEventListener("pointerdown", skip)
      window.removeEventListener("wheel", skip)
    }
  }, [onSkip])

  return (
    <>
      <Comet from={view.from} to={view.to} length={view.length} />
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center">
        <m.p
          className="sky-scrim px-3 text-xs text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {view.touch ? "Tap to skip" : "Press any key to skip"}
        </m.p>
      </div>
    </>
  )
}

export default IntroSequence
