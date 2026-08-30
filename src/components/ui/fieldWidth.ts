/**
 * Field widths for the form primitives (Input, Select, Textarea).
 *
 * All three default to `w-full`, which suits stacked form layouts but has to
 * yield when a caller wants a field sized to its content — a filter dropdown in
 * a toolbar, say. A caller can't simply pass `w-auto`: Tailwind emits width
 * utilities in alphabetical order, so `.w-full` lands after `.w-auto`, `.w-fit`
 * and every numeric or fractional width, and wins the specificity tie no matter
 * what order the classes appear in on the element. The override looks applied
 * and silently isn't — it only narrows where a flex row happens to shrink it.
 *
 * So the default is dropped when the caller supplies a width of their own,
 * rather than left to fight it.
 */

/**
 * Matches an unprefixed width utility — `w-auto`, `!w-32`, `w-1/2` — but not
 * `max-w-xs` or `min-w-0`, and deliberately not a variant-prefixed one like
 * `sm:w-1/2` or `hover:w-64`. A variant width is an override on top of a base
 * width, and wins on its own because Tailwind emits variants after the base
 * utilities; dropping `w-full` for it would strip the intended mobile default.
 */
const WIDTH_CLASS = /^!?w-/

export function hasWidthClass(className: string): boolean {
  return className.split(/\s+/).some(token => WIDTH_CLASS.test(token))
}

/** The default width class, or '' when the caller has specified their own. */
export function defaultFieldWidth(className: string): string {
  return hasWidthClass(className) ? '' : 'w-full'
}
