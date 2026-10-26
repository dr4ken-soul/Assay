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
  /** Milliseconds from the run settling to the verdict being complete. */
  verdictMs: number
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
 * Do not type a number here that the tool did not measure. The bound trial
 * below is t_mvpt4zxe_2ntqd, recorded live on 2026-10-26 through the
 * marketplace build of the app: one workload, three blind columns, one
 * crown, then the reveal. Tokens and latency are as the tool measured them;
 * the platform's Anna lanes do not report a cost figure, so the cost card
 * keeps its unmeasured state rather than an estimate.
 */
export const CORPUS: Corpus = {
  bound: true,
  trials: [
    {
      id: 't_mvpt4zxe_2ntqd',
      createdAt: '2026-10-26T22:07:38.978Z',
      workload:
        'Write a 90-word product description for Assay, a blind trial bench that runs one real workload across several language models and hides their names until the user picks a winner. British English. No em dashes. No bullet points.',
      revealed: [
        { letter: 'MODEL A', label: 'google/gemini-3-flash-preview', modelId: 'anna/speed', source: 'anna' },
        { letter: 'MODEL B', label: 'google/gemini-3-flash-preview', modelId: 'anna/cost', source: 'anna' },
        { letter: 'MODEL C', label: 'google/gemini-3-flash-preview', modelId: 'anna/intelligence', source: 'anna' },
      ],
      scores: {
        'MODEL A': { correctness: 5, instructionFit: 5, concision: 5, tone: 5, grounding: 5 },
        'MODEL B': { correctness: 5, instructionFit: 5, concision: 5, tone: 5, grounding: 5 },
        'MODEL C': { correctness: 5, instructionFit: 5, concision: 5, tone: 5, grounding: 5 },
      },
      costUsd: { 'MODEL A': null, 'MODEL B': null, 'MODEL C': null },
      latencyMs: { 'MODEL A': 2298, 'MODEL B': 3470, 'MODEL C': 2689 },
      failedCount: 0,
      crowned: 'MODEL A',
      priceTableVersion: '2026-09-28.v1',
      verdictMs: 3957,
    },
  ],
}
