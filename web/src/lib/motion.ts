/**
 * Motion primitives for the landing page.
 *
 * Blur-in is the default entrance. Every scroll animation replays on re-entry,
 * so every `whileInView` uses exactly one viewport rule and there are no
 * exceptions. Under reduced motion the blur is dropped and elements fade in
 * place, so nothing moves.
 */

'use client'

import { useEffect, useState } from 'react'
import type { Transition, Variants } from 'motion/react'

/** The spec easing curve. */
export const EASE = [0.16, 1, 0.3, 1] as const

/** The standard entrance transition. */
export const ENTER: Transition = { duration: 0.7, ease: EASE }

/** The viewport rule. Every whileInView in this project uses exactly this. */
export const VIEWPORT = { once: false, amount: 0.1 } as const

/** The stagger step for grouped children, in seconds. */
export const STAGGER_STEP = 0.09

/**
 * The stagger delay for a grouped child.
 * @param index The position in the group.
 * @param base The base delay, 0.15 by default.
 * @returns The delay in seconds.
 */
export function stagger(index: number, base = 0.15): number {
  return base + index * STAGGER_STEP
}

/**
 * Builds the standard blur-in entrance.
 * @param reduced Whether the user asked for reduced motion.
 * @param index The position in the group, for the stagger.
 * @param distance The travel distance in pixels.
 * @returns The variants object.
 */
export function enterVariants(reduced: boolean, index = 0, distance = 20): Variants {
  if (reduced) {
    return { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } }
  }
  return {
    hidden: { filter: 'blur(10px)', opacity: 0, y: distance },
    visible: { filter: 'blur(0px)', opacity: 1, y: 0, transition: { ...ENTER, delay: stagger(index) } },
  }
}

/**
 * Tracks the user's reduced motion preference, live.
 * @returns True when the user asked for reduced motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  return reduced
}
