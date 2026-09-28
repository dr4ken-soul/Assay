/**
 * Section 5, the metrics.
 *
 * The breathing section between the statement and the policy, followed by the
 * bench knoll strip. The three measures are the same three the anatomy cards
 * use, pulled from the same corpus, and a measure the corpus cannot back drops
 * its slot rather than showing a dash.
 */

'use client'

import { motion } from 'motion/react'
import { CountUp, Reveal, useReducedMotion } from '@/components/primitives'
import { corpusIsBound, metrics } from '@/data/measures'

/**
 * The metrics section.
 * @returns The section element.
 */
export default function Metrics() {
  const reduced = useReducedMotion()
  const bound = corpusIsBound()
  const measures = metrics()

  const entries = [
    { key: 'gap', value: measures.medianCostGap, format: (v: number) => `${v.toFixed(1)}X`, label: 'COST GAP ACROSS ONE TRIAL' },
    { key: 'verdict', value: measures.secondsToVerdict, format: (v: number) => v.toFixed(1), label: 'SECONDS TO VERDICT' },
    { key: 'bench', value: measures.modelsOnBench, format: (v: number) => String(v), label: 'MODELS ON THE BENCH' },
  ].filter((entry) => entry.value !== null)

  return (
    <section data-density="sparse" className="px-6 py-24 md:px-10 md:py-32">
      <div className="relative z-10 mx-auto max-w-6xl">
        <p className="mb-14 text-center font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">MEASURED, NOT PROMISED</p>

        {bound && entries.length > 0 ? (
          <div className="grid grid-cols-1 gap-10 text-center md:grid-cols-3 md:gap-12">
            {entries.map((entry, index) => (
              <Reveal key={entry.key} index={index}>
                <p className="font-display text-5xl font-black leading-none text-ink-primary md:text-6xl lg:text-7xl">
                  <CountUp value={entry.value as number} format={entry.format} />
                </p>
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">{entry.label}</p>
                {index < entries.length - 1 ? (
                  <span className="mx-auto mt-10 block h-12 w-px bg-line md:hidden" aria-hidden="true" />
                ) : null}
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-[52ch] rounded-lg border border-dashed border-line p-10 text-center">
            <p className="font-body text-base font-medium text-ink-primary">Measured, not promised</p>
            <p className="mt-2 font-body text-sm text-ink-secondary">
              These three figures come from the recorded trial corpus. There is nothing recorded yet, so the numbers are
              absent rather than approximate.
            </p>
          </div>
        )}

        <Reveal delay={0.3} className="mt-16">
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-line md:aspect-[21/9]">
            <motion.img
              src="/images/bench-knoll.svg"
              alt="The Assay Bench, knolled: caliper, stopwatch, weights, prism and gauge laid out on the cool grey surface"
              loading="lazy"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
              whileInView={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
              viewport={{ once: false, amount: 0.1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : 0.3 }}
              className="h-full w-full object-cover"
            />
          </div>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            THE BENCH: CALIPER, FORK, WEIGHTS, PRISM, GAUGE
          </p>
        </Reveal>
      </div>
    </section>
  )
}
