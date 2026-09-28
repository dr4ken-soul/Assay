/**
 * Motion primitives and the reduced motion switch.
 *
 * The standard entrance is a blur-in. Under `prefers-reduced-motion` the blur
 * is dropped and the element fades in place, so nothing moves.
 */

import { useEffect, useState } from 'react'
import type { Transition, Variants } from 'motion/react'

/** The spec easing curve, used by every entrance. */
export const EASE = [0.16, 1, 0.3, 1] as const

/** The standard entrance transition. */
export const ENTER_TRANSITION: Transition = { duration: 0.7, ease: EASE }

/** The staggered delay for a grouped child at a given index. */
export function staggerDelay(index: number, base = 0.15, step = 0.09): number {
  return base + index * step
}

/**
 * Builds the standard entrance variants.
 * @param reduced Whether the user asked for reduced motion.
 * @param index The position in a group, for the stagger delay.
 * @returns The variants object.
 */
export function enterVariants(reduced: boolean, index = 0): Variants {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.3 } },
    }
  }
  return {
    hidden: { filter: 'blur(10px)', opacity: 0, y: 20 },
    visible: {
      filter: 'blur(0px)',
      opacity: 1,
      y: 0,
      transition: { ...ENTER_TRANSITION, delay: staggerDelay(index) },
    },
  }
}

/** The viewport rule. Every whileInView in this project uses exactly this. */
export const VIEWPORT = { once: false, amount: 0.1 } as const

/**
 * Tracks the user's reduced motion preference, live.
 * @returns True when the user asked for reduced motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  return reduced
}
