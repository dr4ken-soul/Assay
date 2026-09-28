/**
 * Inline SVG icon set.
 *
 * Inline SVG only, no icon library and no emoji as a UI element. Every icon is
 * a single path or a small group, drawn on a 24 unit grid with a 1.5 stroke.
 */

import type { SVGProps } from 'react'

/** Shared stroke props, so every icon matches the same weight. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * A check mark, for a selected roster chip.
 * @param props Standard SVG props.
 * @returns The icon element.
 */
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" {...props}>
      <path d="M3 8.5 6.5 12 13 4.5" {...stroke} />
    </svg>
  )
}

/**
 * A chevron pointing right, for the ledger rows.
 * @param props Standard SVG props.
 * @returns The icon element.
 */
export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path d="m9 5 7 7-7 7" {...stroke} />
    </svg>
  )
}

/**
 * A right arrow, for the trailing circle inside a primary button.
 * @param props Standard SVG props.
 * @returns The icon element.
 */
export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" {...props}>
      <path d="M4 12h15m-6-6 6 6-6 6" {...stroke} />
    </svg>
  )
}

/**
 * A back arrow, for leaving the ledger detail view.
 * @param props Standard SVG props.
 * @returns The icon element.
 */
export function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path d="M20 12H5m6 6-6-6 6-6" {...stroke} />
    </svg>
  )
}
