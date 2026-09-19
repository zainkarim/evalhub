/**
 * Tiny helpers for building parameterised SQL.
 * Column names ONLY ever come from the whitelist maps in the route files —
 * never from request input — so dynamic SET clauses are injection-safe.
 */

/** Build `col = $n` fragments for the fields present in `body`. */
export function buildUpdate(body, columnMap, startIndex = 1) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (body[key] !== undefined) {
      values.push(body[key]);
      sets.push(`${column} = $${startIndex + values.length - 1}`);
    }
  }
  return { sets, values };
}

/** Escape LIKE/ILIKE wildcards in user input. */
export const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

export const pageOffset = (page, pageSize) => (page - 1) * pageSize;
