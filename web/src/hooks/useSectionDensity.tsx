/**
 * Section density.
 *
 * Every `<section data-density="...">` reports its own presence here, and the
 * CalibrationField reads the winner to set its opacity. A single observer over
 * all sections beats one observer per section, and it keeps the density a
 * single source of truth.
 */

'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** The density bands the spec defines. */
export type Density = 'hero' | 'sparse' | 'dense'

/** The shared value. */
const DensityContext = createContext<Density>('hero')

/**
 * Reads the density of whichever section is in view.
 * @returns The current density band.
 */
export function useSectionDensity(): Density {
  return useContext(DensityContext)
}

/**
 * Observes every density section and publishes the winning band.
 *
 * @param children The page tree.
 * @returns The provider wrapping the page.
 */
export function SectionDensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<Density>('hero')

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('section[data-density]'))
    if (sections.length === 0) return undefined

    const visible = new Map<Density, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const band = (entry.target as HTMLElement).dataset.density as Density
          if (entry.isIntersecting) {
            visible.set(band, entry.intersectionRatio)
          } else {
            visible.delete(band)
          }
        }
        if (visible.size === 0) return
        // Whichever band has the most on screen wins, hero breaks a tie.
        const ranked = [...visible.entries()].sort((a, b) => b[1] - a[1])
        setDensity(ranked[0][0])
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    )

    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const value = useMemo(() => density, [density])
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
}
