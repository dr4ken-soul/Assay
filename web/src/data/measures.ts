/**
 * The measures the anatomy and metrics sections render.
 *
 * Everything here is derived from the recorded corpus, never typed in by hand.
 * A measure that the corpus cannot back comes back as `null`, and the section
 * that would have rendered it drops the card. That is the removal rule, and it
 * lives here so no section can quietly invent a figure.
 */

import { CORPUS, type CorpusTrial } from './corpus'

/** One column of the anatomy report. */
export interface AnatomyColumn {
  letter: string
  label: string
  scores: CorpusTrial['scores'][string]
  costUsd: number | null
  latencyMs: number
  /** True when this column won the crown. */
  crowned: boolean
  /** True when this column led on quality. */
  qualityLeader: boolean
  /** True when this column led on value. */
  valueLeader: boolean
}

/** The full anatomy payload, or null when nothing is bound. */
export interface Anatomy {
  trialId: string
  createdAt: string
  workload: string
  columns: AnatomyColumn[]
  failedCount: number
  priceTableVersion: string
}

/** The three corpus measures the metrics section renders. */
export interface Metrics {
  /** The median cost gap between the cheapest and dearest column, as a ratio. */
  medianCostGap: number | null
  /** The seconds from the run settling to the verdict being complete. */
  secondsToVerdict: number | null
  /** The number of models on the bench in the recorded trial. */
  modelsOnBench: number | null
}

/** The five axes and their published weights, the same as the judge's rubric. */
export const RUBRIC_AXES: Array<{ key: keyof CorpusTrial['scores'][string]; label: string; weight: number }> = [
  { key: 'correctness', label: 'Correctness', weight: 30 },
  { key: 'instructionFit', label: 'Instruction fit', weight: 25 },
  { key: 'concision', label: 'Concision', weight: 15 },
  { key: 'tone', label: 'Tone', weight: 15 },
  { key: 'grounding', label: 'Grounding', weight: 15 },
]

/**
 * The weighted quality share of one column, 0 to 1.
 * @param scores The five rubric scores.
 * @returns The weighted share.
 */
function qualityShare(scores: CorpusTrial['scores'][string]): number {
  const total = RUBRIC_AXES.reduce((sum, axis) => sum + scores[axis.key] * axis.weight, 0)
  return total / (5 * 100)
}

/**
 * The three columns the anatomy card shows, capped so the card stays readable.
 * @param trial The recorded trial.
 * @returns The leading columns by quality.
 */
function leadingColumns(trial: CorpusTrial): AnatomyColumn[] {
  const rows = trial.revealed.map((column) => ({
    ...column,
    share: qualityShare(trial.scores[column.letter] ?? { correctness: 0, instructionFit: 0, concision: 0, tone: 0, grounding: 0 }),
  }))
  const ranked = [...rows].sort((a, b) => b.share - a.share)
  const best = ranked[0]
  const cheapest = [...rows].sort(
    (a, b) => (trial.costUsd[a.letter] ?? Number.POSITIVE_INFINITY) - (trial.costUsd[b.letter] ?? Number.POSITIVE_INFINITY),
  )[0]
  const shown = new Set([best.letter, cheapest.letter, rows[0].letter])

  return [...rows]
    .filter((row) => shown.has(row.letter))
    .slice(0, 3)
    .map((row) => ({
      letter: row.letter,
      label: row.label,
      scores: trial.scores[row.letter],
      costUsd: trial.costUsd[row.letter] ?? null,
      latencyMs: trial.latencyMs[row.letter] ?? 0,
      crowned: trial.crowned === row.letter,
      qualityLeader: row.letter === best.letter,
      valueLeader: row.letter === cheapest.letter,
    }))
}

/**
 * Reads the anatomy payload from the corpus.
 * @returns The anatomy report, or null when no trial is bound.
 */
export function anatomy(): Anatomy | null {
  const trial = CORPUS.trials[0]
  if (!CORPUS.bound || !trial) return null
  return {
    trialId: trial.id,
    createdAt: trial.createdAt,
    workload: trial.workload,
    columns: leadingColumns(trial),
    failedCount: trial.failedCount,
    priceTableVersion: trial.priceTableVersion,
  }
}

/**
 * Derives the three measures.
 *
 * Each returns null rather than a guess when the corpus cannot back it, and the
 * section drops the card. `secondsToVerdict` is only available when a trial
 * records it, which is why `verdictMs` is part of the corpus shape.
 * @returns The measures, each nullable.
 */
export function metrics(): Metrics {
  const trial = CORPUS.trials[0]
  if (!CORPUS.bound || !trial) {
    return { medianCostGap: null, secondsToVerdict: null, modelsOnBench: null }
  }

  const costs = trial.revealed
    .map((column) => trial.costUsd[column.letter])
    .filter((value): value is number => value !== null && value !== undefined)
    .sort((a, b) => a - b)

  const medianCostGap = costs.length >= 2 && costs[0] > 0 ? costs[costs.length - 1] / costs[0] : null
  const verdictMs = (trial as CorpusTrial & { verdictMs?: number }).verdictMs
  const secondsToVerdict = typeof verdictMs === 'number' ? Math.round(verdictMs / 100) / 10 : null
  const modelsOnBench = trial.revealed.length > 0 ? trial.revealed.length : null

  return { medianCostGap, secondsToVerdict, modelsOnBench }
}

/** Whether the measured sections have anything to show. */
export function corpusIsBound(): boolean {
  return CORPUS.bound && CORPUS.trials.length > 0
}
