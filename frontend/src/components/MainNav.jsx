import { NavLink } from "react-router-dom"

// The small orange counter next to a link ("3 waiting").
export function NavBadge({ count }) {
  if (count <= 0) return null
  return (
    <span
      className="min-w-[1.25rem] rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-accent-fg"
      aria-label={`${count} waiting`}
    >
      {count}
    </span>
  )
}

// Desktop navigation (from `lg` up; below that the hamburger panel is used).
// `items` is already filtered for the person's role by Layout. NavLink sets
// aria-current="page" on the active link by itself.
function MainNav({ items, counts }) {
  return (
    <nav aria-label="Main" className="hidden h-full items-stretch gap-1 lg:flex">
      {items.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm ${
              isActive
                ? "font-medium text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent-ink"
                : "text-muted hover:text-ink"
            }`
          }
        >
          {link.label}
          <NavBadge count={counts[link.badge] ?? 0} />
        </NavLink>
      ))}
    </nav>
  )
}

export default MainNav
