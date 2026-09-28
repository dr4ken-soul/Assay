/**
 * The trial corpus.
 *
 * Every number the landing page shows traces to a trial in this file. The file
 * ships EMPTY on purpose.
 *
 * The rule is a removal rule, not an estimate rule: if the corpus cannot back a
 * number, the card that would have shown it is not rendered. A landing page
 * with fewer cards is correct. A landing page with an invented card is not.
 *
 * To bind the anatomy and metrics sections to a real trial:
 *
 *   1. install Assay from the Anna Marketplace
 *   2. run one trial on a workload you are happy to publish
 *   3. crown a winner and lift the blind
 *   4. copy the trial record out of the app window
 *   5. paste it below and set `bound: true`
 *
 * `bound` gates the sections that make a claim about measured data. Until it is
 * true those sections render their honest empty state, not a placeholder.
 */

/** One recorded trial, as the tool stores it. */
export interface CorpusTrial {
  /** The trial id from the tool. */
  id: string
  /** When the trial ran, ISO. */
  createdAt: string
  /** The published workload. */
  workload: string
  /** Letter to model label, as the reveal returned it. */
  revealed: Array<{ letter: string; label: string; modelId: string; source: 'byok' | 'anna' }>
  /** Rubric scores per letter, 0 to 5. */
  scores: Record<string, { correctness: number; instructionFit: number; concision: number; tone: number; grounding: number }>
  /** Measured token cost in USD per letter. */
  costUsd: Record<string, number | null>
  /** Measured wall clock per letter, in milliseconds. */
  latencyMs: Record<string, number>
  /** How many columns failed. */
  failedCount: number
  /** The crowned letter, or `tie`. */
  crowned: string
  /** The price table version the cost came from. */
  priceTableVersion: string
}

/** The corpus, empty until a real trial is pasted in. */
export interface Corpus {
  /** Whether at least one real trial has been recorded. */
  bound: boolean
  /** The recorded trials, newest first. */
  trials: CorpusTrial[]
}

/**
 * The recorded trials.
 *
 * Replace this object with real runs. Do not type a number here that the tool
 * did not measure.
 */
export const CORPUS: Corpus = {
  bound: false,
  trials: [],
}
