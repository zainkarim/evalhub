import { m } from "motion/react"
import GoldStar from "../brand/GoldStar"

// Nine golden sparkles around the logo and the title, on the edges of the lockup (so
// they never sit over a letter). Each one scales in 0 -> 1.15 -> 1 while turning about
// 15 degrees, holds, then twinkles out once; they are staggered by ~110 ms. Intro
// only: they are not rendered in the final state. Decorative (aria-hidden); the
// motion is transform and opacity only.
const SPARKLES = [
  { top: "-9%", left: "3%", size: 16 },
  { top: "-12%", left: "46%", size: 9 },
  { top: "-8%", left: "93%", size: 18 },
  { top: "34%", left: "-7%", size: 7 },
  { top: "62%", left: "103%", size: 12 },
  { top: "104%", left: "10%", size: 11 },
  { top: "108%", left: "52%", size: 17 },
  { top: "102%", left: "88%", size: 8 },
  { top: "16%", left: "104%", size: 6 },
]

function Sparkles({ start = 1.5 }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {SPARKLES.map((item, index) => (
        <m.span
          key={index}
          className="absolute"
          style={{ top: item.top, left: item.left }}
          initial={{ opacity: 0, scale: 0, rotate: -15 }}
          animate={{
            opacity: [0, 1, 1, 0.9, 0],
            scale: [0, 1.15, 1, 1, 0.5],
            rotate: [-15, 0, 0, 0, 10],
          }}
          transition={{ delay: start + index * 0.11, duration: 1.0, times: [0, 0.25, 0.4, 0.8, 1], ease: "easeOut" }}
        >
          <GoldStar size={item.size} />
        </m.span>
      ))}
    </span>
  )
}

export default Sparkles
