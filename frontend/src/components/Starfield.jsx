import { useEffect, useRef } from "react"
import { createStarfield } from "../lib/starfield"

// A fixed canvas behind the whole app: stars, a slow twinkle, an occasional
// comet. The sky colour is CSS (.starfield-sky); the engine in lib/starfield.js
// paints the stars. It is decoration only: hidden from assistive tech, never
// takes clicks, and is fixed so it cannot affect layout or scrolling.
//
// variant "hero" is the denser sky for the login page. Text on top of the sky
// needs a surface or a .sky-scrim (checked in dev by lib/skyTextCheck.js).
function Starfield({ variant = "app" }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const engine = createStarfield(canvasRef.current, { variant })
    // Dev only: the check is imported lazily, so it never reaches the production bundle.
    let stopCheck = () => {}
    let cancelled = false
    if (import.meta.env.DEV) {
      import("../lib/skyTextCheck").then((module) => {
        if (!cancelled) stopCheck = module.startSkyTextCheck()
      })
    }
    return () => {
      cancelled = true
      stopCheck()
      engine.destroy()
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="starfield-sky pointer-events-none fixed inset-0 -z-10 h-lvh w-full"
    />
  )
}

export default Starfield
