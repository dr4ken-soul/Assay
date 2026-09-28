/**
 * Section 4, the verdict anatomy.
 *
 * An asymmetric bento over one real recorded trial. Every figure on this page
 * comes out of `web/src/data/corpus.ts`, and every measure the corpus cannot
 * back has its card removed rather than filled with an estimate.
 *
 * Until a trial is bound the section renders its honest state. It says the
 * section is waiting on a recorded run, and it shows the rubric card, which is
 * a statement about the method rather than a claim about a measurement.
 */

'use client'

import { motion } from 'motion/react'
import { DoubleBezel, Reveal, RubricBar, useReducedMotion } from '@/components/primitives'
import { RUBRIC_AXES, anatomy, corpusIsBound, metrics } from '@/data/measures'
import { formatDate } from '@/lib/format'

/**
 * The three corpus cards. A null measure drops its card.
 * @returns The card grid, or null when nothing is bound.
 */
function CorpusCards() {
  const measures = metrics()
  const cards = [
    { key: 'gap', value: measures.medianCostGap, label: 'MEDIAN COST GAP FOUND', format: (v: number) => `${v.toFixed(1)}X` },
    { key: 'verdict', value: measures.secondsToVerdict, label: 'SECONDS TO VERDICT', format: (v: number) => v.toFixed(1) },
    { key: 'bench', value: measures.modelsOnBench, label: 'MODELS ON THE BENCH', format: (v: number) => String(v) },
  ].filter((card) => card.value !== null)

  if (cards.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 lg:col-span-12 lg:grid-cols-3">
      {cards.map((card, index) => (
        <Reveal key={card.key} index={index} className="lg:col-span-1">
          <div className="rounded-lg border border-line bg-bench-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:bg-bench-elevated">
            <p className="font-display text-3xl font-black tabular-nums text-ink-primary md:text-4xl">
              {card.format(card.value as number)}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted">{card.label}</p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

/**
 * The anatomy section.
 * @returns The section element.
 */
export default function Anatomy() {
  const reduced = useReducedMotion()
  const report = anatomy()
  const bound = corpusIsBound()

  return (
    <section id="anatomy" data-density="dense" className="bg-bench-primary px-6 py-24 md:px-10 md:py-32">
      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal delay={0.1} className="mb-12">
          <h2 className="font-display text-3xl font-black uppercase tracking-[-0.02em] text-ink-primary md:text-4xl">
            ANATOMY OF A VERDICT
          </h2>
          <p className="mt-3 max-w-[60ch] font-body text-sm text-ink-secondary">
            {bound
              ? 'An annotated extract from a real Assay trial. The workload, the scores and the costs are exactly what the app recorded.'
              : 'This section renders one real recorded Assay trial. Nothing is published here until a real run has been recorded and the workload beside it, because an invented number is worse than an empty card.'}
          </p>
        </Reveal>

        {bound && report ? (
          <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
            <Reveal index={0} className="lg:col-span-7 lg:row-span-2">
              <DoubleBezel className="h-full">
                <div className="mb-5 flex justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                  <span>TRIAL {report.trialId.slice(0, 8).toUpperCase()}</span>
                  <span>{formatDate(report.createdAt)}</span>
                </div>
                <p className="mb-5 font-mono text-xs leading-relaxed text-ink-secondary">
                  <span className="text-ink-muted">TASK:</span> {report.workload}
                </p>

                <div className="grid grid-cols-3 gap-4">
                  {report.columns.map((column) => (
                    <div key={column.letter}>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-secondary">{column.label}</p>
                      {RUBRIC_AXES.map((axis, index) => (
                        <div key={axis.key}>
                          <p className="mt-2 font-mono text-[10px] text-ink-muted">{axis.label}</p>
                          <RubricBar score={column.scores[axis.key]} leader={column.qualityLeader} delay={index * 0.08} />
                        </div>
                      ))}
                      <p className="mt-3 font-mono text-[11px] tabular-nums text-ink-secondary">
                        {column.costUsd === null ? 'ANNA CREDITS' : `$${column.costUsd.toFixed(4)}`} /{' '}
                        {(column.latencyMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-6 border-t border-line-subtle pt-4 font-mono text-xs text-ink-primary">
                  VERDICT: {report.columns.find((column) => column.qualityLeader)?.letter} ON QUALITY,{' '}
                  {report.columns.find((column) => column.valueLeader)?.letter} ON VALUE. FULL MARGIN PUBLISHED BELOW.
                </p>

                <div className="pointer-events-none relative mt-4 hidden lg:block">
                  <span className="absolute -left-2 top-0 font-mono text-[10px] text-ink-secondary">RUBRIC, 0 TO 5</span>
                  <span className="absolute right-0 top-1/3 font-mono text-[10px] text-ink-secondary">SERVER-SIDE TIMING</span>
                  <span className="absolute bottom-0 left-1/3 font-mono text-[10px] text-ink-secondary">
                    TOKEN COST, NOT SUBSCRIPTION
                  </span>
                </div>
              </DoubleBezel>
            </Reveal>

            <Reveal index={1} className="lg:col-span-5">
              <div className="h-full rounded-lg border border-line bg-bench-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:bg-bench-elevated">
                <h3 className="font-body text-base font-medium text-ink-primary">SCORED BLIND, FIVE AXES</h3>
                {RUBRIC_AXES.map((axis) => (
                  <div
                    key={axis.key}
                    className="flex justify-between border-b border-line-subtle py-3 last:border-0"
                  >
                    <span className="font-body text-sm text-ink-secondary">{axis.label}</span>
                    <span className="font-mono text-xs text-ink-muted">{axis.weight}</span>
                  </div>
                ))}
                <p className="mt-4 font-mono text-[11px] leading-relaxed text-ink-muted">
                  THE EXAMINER NEVER SEES MODEL NAMES.
                </p>
              </div>
            </Reveal>

            <CorpusCards />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="rounded-lg border border-dashed border-line p-10 text-center">
                <p className="font-body text-base font-medium text-ink-primary">Waiting on a recorded trial</p>
                <p className="mx-auto mt-2 max-w-[48ch] font-body text-sm text-ink-secondary">
                  The report card renders from a real run. Run one trial in the app, crown a winner, lift the blind, and
                  paste the record into the corpus file. Until then this card is absent by design.
                </p>
              </div>
            </div>

            <Reveal index={1} className="lg:col-span-5">
              <div className="h-full rounded-lg border border-line bg-bench-surface p-6">
                <h3 className="font-body text-base font-medium text-ink-primary">SCORED BLIND, FIVE AXES</h3>
                {RUBRIC_AXES.map((axis) => (
                  <div key={axis.key} className="flex justify-between border-b border-line-subtle py-3 last:border-0">
                    <span className="font-body text-sm text-ink-secondary">{axis.label}</span>
                    <span className="font-mono text-xs text-ink-muted">{axis.weight}</span>
                  </div>
                ))}
                <p className="mt-4 font-mono text-[11px] leading-relaxed text-ink-muted">
                  THE EXAMINER NEVER SEES MODEL NAMES.
                </p>
              </div>
            </Reveal>
          </div>
        )}

        {!reduced ? <span className="sr-only">The rubric weighs correctness 30, instruction fit 25, concision 15, tone 15, grounding 15.</span> : null}
      </div>
    </section>
  )
}

/** Re-exported so the metrics section can share the animation import. */
export { motion }
