/**
 * Shared landing page primitives.
 *
 * The blur-in reveal, the word-by-word headline reveal, the count-up metric and
 * the double bezel. Every one of them reads from the design system and none of
 * them hardcode a colour.
 */

'use client'

import { motion, useInView } from 'motion/react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { EASE, ENTER, VIEWPORT, enterVariants, useReducedMotion } from '@/lib/motion'

/**
 * The standard scroll reveal. Blur in, play every time it re-enters.
 * @param children The content to reveal.
 * @param index The position in a group, for the stagger.
 * @param className Extra classes on the wrapper.
 * @param distance The travel distance in pixels.
 * @returns The revealed element.
 */
export function Reveal({
  children,
  index = 0,
  className = '',
  distance = 20,
  delay,
}: {
  children: ReactNode
  index?: number
  className?: string
  distance?: number
  /** Overrides the computed stagger delay, in seconds. */
  delay?: number
}) {
  const reduced = useReducedMotion()
  const variants = enterVariants(reduced, index, distance)
  if (delay !== undefined && variants.visible && typeof variants.visible === 'object') {
    variants.visible = {
      ...(variants.visible as object),
      transition: { duration: reduced ? 0.4 : 0.7, ease: EASE, delay },
    }
  }
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  )
}

/**
 * A headline revealed word by word, each word blurring in on its own beat.
 * @param text The headline, already uppercased by the caller if it should be.
 * @param className Extra classes on each word wrapper.
 * @param wordClassName Extra classes on the heading itself.
 * @returns The heading.
 */
export function SplitHeadline({
  text,
  className = '',
  delayStep = 0.09,
  duration = 0.7,
}: {
  text: string
  className?: string
  delayStep?: number
  duration?: number
}) {
  const reduced = useReducedMotion()
  const words = text.split(' ')

  return (
    <h1 className={className}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="inline-block overflow-hidden align-bottom">
            <motion.span
              className="inline-block"
              initial={reduced ? { opacity: 0 } : { filter: 'blur(10px)', opacity: 0, y: 24 }}
              animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
              transition={
                reduced
                  ? { duration: 0.3, delay: index * 0.03 }
                  : { duration, ease: EASE, delay: index * delayStep }
              }
            >
              {word}
            </motion.span>
          </span>
          {/*
            The space sits outside the overflow-hidden clip. Inside it the
            browser collapses the trailing whitespace and the words run
            together: YOUARECHOOSINGMODELSONMARKETING.
          */}
          {index < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </h1>
  )
}

/**
 * A number that counts up when it scrolls into view, and replays on re-entry.
 * @param value The final value.
 * @param format How to render it, for example `(n) => n.toFixed(0)`.
 * @param duration The count duration in milliseconds.
 * @returns The formatted number.
 */
export function CountUp({
  value,
  format,
  duration = 1500,
}: {
  value: number
  format: (value: number) => string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, VIEWPORT)
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView) {
      setShown(0)
      return undefined
    }
    if (reduced) {
      setShown(value)
      return undefined
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(value * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, value, duration, reduced])

  return (
    <span ref={ref} className="tabular-nums">
      {format(shown)}
    </span>
  )
}

/**
 * The double bezel. The inner radius is always smaller than the outer.
 * @param children The card contents.
 * @param className Extra classes on the outer frame.
 * @returns The card.
 */
export function DoubleBezel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-tile p-2 ring-1 ring-line-subtle ${className}`} style={{ background: 'var(--bg-secondary)' }}>
      <div className="rounded-lg bg-bench-elevated p-5 shadow-tile">{children}</div>
    </div>
  )
}

/**
 * A rubric bar that fills on entry, colour paired with the numeric score.
 * @param score The score, 0 to 5.
 * @param leader Whether this column won, which turns the fill red.
 * @param delay The fill delay in seconds.
 * @returns The bar row.
 */
export function RubricBar({ score, leader = false, delay = 0 }: { score: number; leader?: boolean; delay?: number }) {
  const width = `${(Math.max(0, Math.min(5, score)) / 5) * 100}%`
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-bench-secondary">
      <motion.div
        className={`h-full rounded-sm ${leader ? 'bg-indicator' : 'bg-ink-primary'}`}
        initial={{ width: 0 }}
        whileInView={{ width }}
        viewport={VIEWPORT}
        transition={{ duration: 0.8, ease: EASE, delay }}
      />
    </div>
  )
}

/**
 * The grain overlay, mounted once at the root.
 * @returns The overlay element.
 */
export function GrainOverlay() {
  return <div className="grain" aria-hidden="true" />
}

/**
 * A section wrapper that declares its density band to the field.
 * @param density The density band for this section.
 * @param children The section contents.
 * @param className Extra classes on the section.
 * @param id The anchor id.
 * @returns The section element.
 */
export function Section({
  density,
  children,
  className = '',
  id,
}: {
  density: 'hero' | 'sparse' | 'dense'
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} data-density={density} className={`relative z-10 ${className}`}>
      {children}
    </section>
  )
}

/** Re-exported so sections import the transition from one place. */
export { ENTER, EASE, VIEWPORT, useReducedMotion }
