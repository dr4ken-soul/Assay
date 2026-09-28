/**
 * Test setup.
 *
 * The bundle renders inside an Anna window, so anything host shaped has to be
 * present before a component mounts. Motion is stubbed to its final frame so
 * assertions are not racing an animation.
 */

import { afterEach, vi } from 'vitest'

/** Whether the environment reports a reduced motion preference. */
export const prefersReducedMotion = true

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

/** Clipboard stub, the policy export writes to it. */
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: { writeText: vi.fn(async () => undefined) },
})

afterEach(() => {
  vi.restoreAllMocks()
})
