/**
 * Section 1, the hero.
 *
 * Top-left lead with bottom-right support. The headline leads, the live trial
 * tile supports. The tile is a working instrument panel, not a mockup: its
 * timers, its cost figures and its columns all animate, and the verdict flip
 * fires once after six seconds of page time.
 */

'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { DoubleBezel, Reveal, SplitHeadline, useReducedMotion } from '@/components/primitives'
import { ArrowIcon } from './Icon'

/** The characters the live figures scrub through while they are counting. */
const SCRAMBLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#'

/** How many characters per frame while scrubbing. */
const SCRAMBLE_SPEED = 30

/** The three anonymised columns in the tile. */
const TILE_COLUMNS = ['MODEL A', 'MODEL B', 'MODEL C']

/** The shimmer line widths inside each column. */
const TILE_LINES = [100, 86, 64]

/** The verdict flip copy. The hero is a promise, not a measurement. */
const VERDICT_FLIP = 'B +38% FASTER AT 0.9X QUALITY'

/**
 * Scrambles a string until it settles on its target.
 * @param target The final text.
 * @param active Whether the scramble should be running.
 * @param reduced Whether motion is reduced, which settles immediately.
 * @returns The current frame of text.
 */
function useScramble(target: string, active: boolean, reduced: boolean): string {
  const [frame, setFrame] = useState(target)

  useEffect(() => {
    if (!active || reduced) {
      setFrame(target)
      return undefined
    }
    let step = 0
    const total = target.length * 3
    const timer = window.setInterval(() => {
      step += 1
      if (step >= total) {
        setFrame(target)
        window.clearInterval(timer)
        return
      }
      setFrame(
        target
          .split('')
          .map((char, index) => (index < step / 3 ? char : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]))
          .join(''),
      )
    }, SCRAMBLE_SPEED)
    return () => window.clearInterval(timer)
  }, [target, active, reduced])

  return frame
}

/**
 * The hero.
 * @returns The section element.
 */
export default function Hero() {
  const reduced = useReducedMotion()
  const [elapsed, setElapsed] = useState(0)
  const [flip, setFlip] = useState(false)

  useEffect(() => {
    if (reduced) {
      setFlip(true)
      return undefined
    }
    const started = performance.now()
    const timer = window.setInterval(() => {
      const seconds = (performance.now() - started) / 1000
      setElapsed(Math.min(9.4, seconds))
      if (seconds >= 6) setFlip(true)
    }, 100)
    return () => window.clearInterval(timer)
  }, [reduced])

  const latency = useScramble(`${(1.2 + elapsed * 0.62).toFixed(2)}s`, elapsed > 0.2 && elapsed < 6, reduced)
  const cost = useScramble(`$${(0.0041 + elapsed * 0.0013).toFixed(4)}`, elapsed > 0.2 && elapsed < 6, reduced)

  return (
    <section
      id="top"
      data-density="hero"
      className="relative min-h-[100dvh] overflow-hidden"
    >
      <div className="relative z-10 px-6 pt-32 md:px-10 md:pt-36 lg:px-16">
        <div className="max-w-[720px]">
          <SplitHeadline
            text="PUT YOUR MODELS ON TRIAL."
            className="font-display text-[clamp(2.75rem,7vw,6.25rem)] font-black uppercase leading-[0.92] tracking-[-0.03em] text-ink-primary [text-wrap:balance]"
          />

          <Reveal delay={0.55} className="mt-6 max-w-[52ch]">
            <p className="font-body text-base leading-relaxed text-ink-secondary md:text-lg">
              Assay runs your real workload across the models you already pay for, strips the names, and returns a
              blind verdict on quality, cost and latency. You choose on evidence, not marketing.
            </p>
          </Reveal>

          <Reveal delay={0.75} className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="https://anna.partners"
              target="_blank"
              rel="noreferrer noopener"
              className="focus-ring group inline-flex items-center gap-3 rounded-full bg-ink-primary px-7 py-3.5 font-mono text-sm uppercase tracking-[0.08em] text-bench-elevated transition-colors duration-200 hover:bg-indicator hover:text-white"
            >
              OPEN IN ANNA
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-px" />
              </span>
            </a>
            <a
              href="#anatomy"
              className="focus-ring rounded-full border border-line px-7 py-3.5 font-mono text-sm uppercase tracking-[0.08em] text-ink-primary transition-colors duration-200 hover:border-indicator hover:text-indicator"
            >
              SEE THE ANATOMY
            </a>
          </Reveal>
        </div>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.97 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduced ? 0.4 : 0.9, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : 0.9 }}
          className="relative z-20 mt-14 w-full max-w-[420px] lg:absolute lg:bottom-16 lg:right-16 lg:mt-0 lg:w-[420px]"
        >
          <DoubleBezel>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">LIVE TRIAL 0047</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indicator" />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-indicator">
                  {flip ? 'VERDICT' : 'RUNNING'}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {TILE_COLUMNS.map((letter, column) => (
                <div key={letter} className="rounded-md border border-line-subtle bg-bench-surface p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-secondary">{letter}</p>
                  <p className="mt-2 font-mono text-sm tabular-nums text-ink-primary">
                    {(Number.parseFloat(latency) + column * 0.41).toFixed(2)}s
                  </p>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-ink-muted">
                    ${(0.0041 + column * 0.0019 + elapsed * 0.0006).toFixed(4)}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {TILE_LINES.map((width, line) => (
                      <div
                        key={line}
                        className="shimmer h-2 rounded-sm bg-bench-secondary"
                        style={{ width: `${Math.max(38, width - column * 8 - line * 6)}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line-subtle pt-4">
              <span className="font-mono text-[11px] text-ink-secondary">NAMES SEALED UNTIL VERDICT</span>
              <AnimatePresence>
                {flip ? (
                  <motion.span
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, rotate: -2 }}
                    animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
                    transition={reduced ? { duration: 0.3 } : { type: 'spring', stiffness: 320, damping: 22 }}
                    className="rounded-sm border border-indicator px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-indicator"
                  >
                    {VERDICT_FLIP}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
            <span className="sr-only">Live cost across the bench reads {cost}</span>
          </DoubleBezel>
        </motion.div>
      </div>
    </section>
  )
}
