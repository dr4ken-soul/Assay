/**
 * Section 2, the statement.
 *
 * One typographic statement, nothing else. The density band is sparse, so the
 * CalibrationField reads through at 0.35 and the empty space is the point.
 */

'use client'

import { motion } from 'motion/react'
import { Reveal, useReducedMotion } from '@/components/primitives'

/** The statement, word by word. */
const STATEMENT = 'YOU ARE CHOOSING MODELS ON MARKETING.'

/**
 * The statement.
 * @returns The section element.
 */
export default function Statement() {
  const reduced = useReducedMotion()
  const words = STATEMENT.split(' ')

  return (
    <section data-density="sparse" className="flex w-full items-center py-28 md:py-40">
      <div className="w-full px-6 md:px-10">
        <h2 className="text-center font-display text-[clamp(2.25rem,6.5vw,5.5rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-ink-primary [text-wrap:balance]">
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className="inline-block overflow-hidden align-bottom">
              <motion.span
                className="inline-block"
                initial={reduced ? { opacity: 0 } : { filter: 'blur(8px)', opacity: 0, y: 20 }}
                whileInView={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.1 }}
                transition={{ duration: reduced ? 0.3 : 0.6, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : index * 0.09 }}
              >
                {word}
                {index < words.length - 1 ? ' ' : ''}
              </motion.span>
            </span>
          ))}
        </h2>

        <Reveal delay={0.9} className="mt-8 text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-ink-muted">
            PUBLISHER BENCHMARKS ARE ADS. YOUR WORKLOAD IS EVIDENCE.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
