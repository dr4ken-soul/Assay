/**
 * Section 6, the policy.
 *
 * Split text and art, recomposed: the art panel is a beam balance mid-pivot,
 * and the policy card below it shows the routing a run of crowns produces. The
 * card's route rows come from the recorded corpus when there is one, and from
 * the published lanes when there is not, because a lane is a statement about
 * the product and a route is a measurement.
 */

'use client'

import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { useRef } from 'react'
import { DoubleBezel, Reveal, useReducedMotion } from '@/components/primitives'
import { corpusIsBound } from '@/data/measures'

/** What the product promises the policy does, stated as lanes not numbers. */
const LANES = [
  { task: 'DRAFT', route: 'DEFAULT, THEN FALLBACK, THEN BUDGET' },
  { task: 'REWRITE', route: 'DEFAULT, THEN FALLBACK, THEN BUDGET' },
  { task: 'CODE', route: 'DEFAULT, THEN FALLBACK, THEN BUDGET' },
]

/** The three bullets. */
const POINTS = [
  'Weights shift with every crown, they decay when they go unused',
  'Locks per task type: draft, rewrite, extract, code, analyse',
  'One-click export, plain JSON, no lock-in',
]

/**
 * The policy section.
 * @returns The section element.
 */
export default function Policy() {
  const reduced = useReducedMotion()
  const sectionRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 26, restDelta: 0.001 })
  const parallax = useTransform(smooth, [0, 1], reduced ? [0, 0] : [-8, 8])
  const bound = corpusIsBound()

  return (
    <section id="policy" ref={sectionRef} data-density="dense" className="bg-bench-primary px-6 py-24 md:px-10 md:py-32">
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
          whileInView={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: reduced ? 0 : 0.3 }}
        >
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-indicator">YOUR POLICY</p>
          <h2 className="font-display text-3xl font-black uppercase leading-tight tracking-[-0.02em] text-ink-primary md:text-4xl">
            STOP PICKING MODELS. START ROUTING THEM.
          </h2>
          <p className="mt-5 max-w-[50ch] font-body text-base leading-relaxed text-ink-secondary">
            Every crown you make shifts the weights. After a handful of trials Assay knows your default, your fallback
            and your budget lane for each task type. Export the policy as JSON and drop it straight into your own agents.
          </p>

          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-indicator" aria-hidden="true" />
                <span className="font-body text-sm text-ink-secondary">{point}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 20 }}
          whileInView={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.1 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: reduced ? 0 : 0.5 }}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line">
            <motion.img
              src="/images/bench-balance.svg"
              alt="A precision beam balance caught mid-pivot on the cool grey bench, the red pointer at centre"
              loading="lazy"
              style={reduced ? undefined : { y: parallax }}
              className="h-full w-full object-cover"
            />
          </div>

          <DoubleBezel className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                {bound ? 'POLICY, RECORDED' : 'POLICY SHAPE'}
              </span>
              <span className="font-mono text-[11px] text-ink-secondary">
                {bound ? 'FROM YOUR LEDGER' : 'BEFORE THE FIRST CROWN'}
              </span>
            </div>

            {LANES.map((lane) => (
              <div key={lane.task} className="flex justify-between border-b border-line-subtle py-3 last:border-0">
                <span className="font-body text-sm text-ink-primary">{lane.task}</span>
                <span className="font-mono text-xs text-ink-secondary">{lane.route}</span>
              </div>
            ))}

            <a
              href="https://anna.partners"
              target="_blank"
              rel="noreferrer noopener"
              className="focus-ring mt-4 block w-full rounded-full border border-ink-primary py-2.5 text-center font-mono text-xs uppercase tracking-[0.08em] text-ink-primary transition-colors duration-200 hover:bg-ink-primary hover:text-bench-elevated"
            >
              BUILD YOUR POLICY
            </a>
          </DoubleBezel>
        </motion.div>
      </div>
    </section>
  )
}
