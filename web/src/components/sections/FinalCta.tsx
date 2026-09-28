/**
 * Section 7, the final call to action.
 *
 * The gauge macro fills the section, the needle sits right of centre and stays
 * visible through the readability wash, and the content sits on top in the
 * top-left register the whole page has used.
 */

'use client'

import { motion } from 'motion/react'
import { Reveal, useReducedMotion } from '@/components/primitives'

/**
 * The final call to action.
 * @returns The section element.
 */
export default function FinalCta() {
  const reduced = useReducedMotion()

  return (
    <section
      data-density="hero"
      className="relative flex min-h-[90dvh] items-center overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="absolute inset-0 z-0">
        <motion.img
          src="/images/bench-gauge.svg"
          alt="A pressure gauge macro, the red needle crossed past the marker on the cool grey bench"
          loading="eager"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="h-full w-full object-cover object-right"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, var(--bg-primary) 34%, rgba(237, 240, 236, 0.88) 52%, rgba(237, 240, 236, 0.35) 78%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-[640px] px-6 md:px-10 lg:px-16">
        <Reveal delay={0.2}>
          <h2 className="font-display text-[clamp(2.25rem,5.5vw,4.5rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-ink-primary [text-wrap:balance]">
            THE NEXT VERDICT IS YOURS
          </h2>
        </Reveal>

        <Reveal delay={0.4} className="mt-5 max-w-[46ch]">
          <p className="font-body text-base text-ink-secondary">
            Open Assay on Anna, paste the workload you ran this morning, and watch three models argue for your business
            with their names off.
          </p>
        </Reveal>

        <Reveal delay={0.6} className="mt-9">
          <a
            href="https://anna.partners"
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring inline-block rounded-full bg-ink-primary px-8 py-4 font-mono text-sm uppercase tracking-[0.08em] text-bench-elevated transition-colors duration-200 hover:bg-indicator hover:text-white"
          >
            OPEN IN ANNA
          </a>
        </Reveal>
      </div>
    </section>
  )
}
