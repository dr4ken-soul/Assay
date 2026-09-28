/**
 * Section 3, the method.
 *
 * Four moves, each with a specimen tile from the Assay Bench series, and a
 * connector drawn down the left margin as the section scrolls. The connector is
 * scrubbed against section progress, never snapped, and it renders fully drawn
 * under reduced motion.
 */

'use client'

import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { useRef } from 'react'
import { Reveal, useReducedMotion } from '@/components/primitives'

/** One move, one specimen. */
const MOVES = [
  {
    step: '01',
    verb: 'ARM',
    body: 'Paste a real workload and pick the models on trial. Your prompt is the benchmark now.',
    asset: '/images/bench-caliper.svg',
    alt: 'A steel vernier caliper open on the bench, one red indicator on the scale',
  },
  {
    step: '02',
    verb: 'RUN',
    body: 'Every model answers in parallel. Latency and token cost are measured server side, names stay sealed.',
    asset: '/images/bench-stopwatch.svg',
    alt: 'A mechanical stopwatch on the bench, red second hand past the marker',
  },
  {
    step: '03',
    verb: 'UNBLIND',
    body: 'Score the anonymised outputs against a fixed rubric, then lift the blind and see which model earned the verdict.',
    asset: '/images/bench-prism.svg',
    alt: 'A glass prism splitting a single beam on the bench, one red edge on the refracted ray',
  },
  {
    step: '04',
    verb: 'ROUTE',
    body: 'Assay folds every verdict into a routing policy you can export. Your default, your fallback, your budget lane.',
    asset: '/images/bench-rail.svg',
    alt: 'Steel rail points mid-switch on the bench, a red signal lamp lit at the tip',
  },
]

/**
 * The method.
 * @returns The section element.
 */
export default function Method() {
  const reduced = useReducedMotion()
  const sectionRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start 0.8', 'end 0.4'] })
  const drawn = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })
  const headLength = useTransform(drawn, [0, 0.82], [0, 60])
  const bodyLength = useTransform(drawn, [0, 0.82], [0, 1])

  return (
    <section
      id="method"
      ref={sectionRef}
      data-density="dense"
      className="relative bg-bench-primary px-6 py-24 md:px-10 md:py-32"
    >
      <div className="relative z-10 mx-auto max-w-4xl">
        <Reveal delay={0.1} className="mb-14">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-indicator">THE METHOD</p>
          <h2 className="font-display text-3xl font-black uppercase tracking-[-0.02em] text-ink-primary md:text-4xl">
            ONE WORKLOAD, FOUR MOVES
          </h2>
        </Reveal>

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -left-7 top-24 hidden h-[calc(100%-8rem)] w-2 lg:block"
          preserveAspectRatio="none"
          viewBox="0 0 2 100"
        >
          <line x1="1" y1="0" x2="1" y2="100" stroke="var(--border-default)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <motion.line
            x1="1"
            y1="0"
            x2="1"
            y2="100"
            stroke="var(--text-primary)"
            strokeWidth="1"
            strokeDasharray="100"
            style={{ pathLength: reduced ? 1 : bodyLength }}
            vectorEffect="non-scaling-stroke"
          />
          <motion.line
            x1="1"
            y1="100"
            x2="1"
            y2="40"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray="60"
            style={{ pathLength: reduced ? 1 : headLength }}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="relative mt-2 flex flex-col gap-4">
          {MOVES.map((move, index) => (
            <Reveal key={move.step} index={index} distance={16}>
              <article className="relative flex items-start gap-5 rounded-lg border border-line bg-bench-surface p-6 transition-colors duration-200 hover:border-indicator/50">
                <span className="min-w-[2.5rem] pt-4 font-mono text-xs text-indicator">{move.step}</span>
                <div className="flex-1">
                  <h3 className="font-body text-base font-medium text-ink-primary md:text-lg">{move.verb}</h3>
                  <p className="mt-1.5 font-body text-sm leading-relaxed text-ink-secondary">{move.body}</p>
                </div>
                <motion.div
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                  whileInView={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  viewport={{ once: false, amount: 0.1 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : 0.3 + index * 0.15 }}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-line-subtle transition-colors duration-200 hover:border-indicator/40 md:h-20 md:w-20"
                >
                  <img src={move.asset} alt={move.alt} loading="lazy" className="h-full w-full object-cover" />
                </motion.div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
