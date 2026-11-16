import { m, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { seen } from "./stagger-state"

// List and card entrance: each item fades in and rises 8px, 35 ms after the one
// before it, for the first 8 items only (the rest appear at once). It happens on
// the first time a list is shown on a page, not every time its data refreshes:
// the items already shown are remembered in `seen` (stagger-state.js) until the
// route changes (Layout calls resetStagger()). Under reduced motion the rise is
// left out (only a fade stays).
const MAX_ANIMATED = 8
const STEP_SECONDS = 0.035

// <StaggerItem as="li" scope="notifications" index={position}>...</StaggerItem>
export function StaggerItem({ as = "div", scope, index, className, children }) {
  const Tag = m[as]
  const reduceMotion = useReducedMotion()
  const key = `${scope}:${index}`
  const [animate] = useState(() => index < MAX_ANIMATED && !seen.has(key))

  useEffect(() => {
    seen.add(key)
  }, [key])

  return (
    <Tag
      className={className}
      initial={animate ? (reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }) : false}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * STEP_SECONDS, ease: "easeOut" }}
    >
      {children}
    </Tag>
  )
}
