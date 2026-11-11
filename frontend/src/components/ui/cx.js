// Joins class names, skipping anything falsy: cx("a", cond && "b") -> "a b".
export function cx(...parts) {
  return parts.filter(Boolean).join(" ")
}
