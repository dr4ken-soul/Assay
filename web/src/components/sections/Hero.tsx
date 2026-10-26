/**
 * Section 1, the hero.
 *
 * Top-left lead with bottom-right support. The tile is a numbers-free picture
 * of the bench before the verdict: three sealed columns, no timers and no
 * costs. Every measured figure lives in the corpus-backed anatomy below.
 */

'use client'

import { motion } from 'motion/react'
import { DoubleBezel, Reveal, SplitHeadline, useReducedMotion } from '@/components/primitives'
import { ArrowIcon } from './Icon'

/** The three anonymised columns in the tile. */
const TILE_COLUMNS = ['MODEL A', 'MODEL B', 'MODEL C']

/** The redacted line widths inside each column. */
const TILE_LINES = [100, 86, 64]

/**
 * The hero.
 * @returns The section element.
 */
export default function Hero() {
  const reduced = useReducedMotion()

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
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">THE BENCH, BLIND</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-secondary">BEFORE THE VERDICT</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {TILE_COLUMNS.map((letter) => (
                <div key={letter} className="rounded-md border border-line-subtle bg-bench-surface p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-secondary">{letter}</p>
                  <div className="mt-3 space-y-1.5">
                    {TILE_LINES.map((width, line) => (
                      <div
                        key={line}
                        className="h-2 rounded-sm bg-bench-secondary"
                        style={{ width: `${Math.max(38, width - line * 6)}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 border-t border-line-subtle pt-4 font-mono text-[11px] text-ink-secondary">
              NAMES SEALED UNTIL VERDICT
            </p>
          </DoubleBezel>
        </motion.div>
      </div>
    </section>
  )
}
