/**
 * Inline SVG icons for the landing page.
 *
 * Inline SVG only. No icon library, no emoji as a UI element.
 */

import type { SVGProps } from 'react'

/** Shared stroke, so every icon matches. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
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
 * A downward arrow, for the scroll cue.
 * @param props Standard SVG props.
 * @returns The icon element.
 */
export function DownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path d="M12 4v15m-6-6 6 6 6-6" {...stroke} />
    </svg>
  )
}
