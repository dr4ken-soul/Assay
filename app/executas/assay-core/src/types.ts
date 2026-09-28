/**
 * Shared type surface for the assay-core Executa.
 *
 * Every type here is JSON-serialisable. The trial record, the verdict report
 * and the policy record are written verbatim into Anna Persistent Storage, so
 * nothing in this file may hold a class instance, a function or a Date.
 */

/** Identifier of a model the user can put on trial, for example `openai/gpt-4o`. */
export type ModelId = string

/** Where a trial column's call is billed and executed. */
export type TrialSource = 'byok' | 'anna'

/** One row of the roster returned by `roster_list`. */
export interface RosterEntry {
  /** Stable identifier used as a roster selection key. */
  id: ModelId
  /** Provider handle, for example `openai`. Anna-backed lanes use `anna`. */
  provider: string
  /** Human label shown on the bench chips, for example `GPT-4o`. */
  label: string
  /** Whether the call runs on an injected credential or on Anna's sampling. */
  source: TrialSource
  /**
   * Whether a credential for this provider is present. Never the credential
   * itself, only its presence. Sampling lanes are always true by definition.
   */
  hasKey: boolean
  /** Soft routing hint passed to Anna's sampling selector, sampling lanes only. */
  hint?: string
  /** Sampling lane priority, sampling lanes only, each in the range 0 to 1. */
  priorities?: {
    cost?: number
    speed?: number
    intelligence?: number
  }
}

/** Anonymised column key, the letter as shown in the UI, for example `MODEL A`. */
export type Letter = string

/** Rubric axes scored by the blind examiner, each from 0 to 5. */
export interface RubricScores {
  correctness: number
  instructionFit: number
  concision: number
  tone: number
  grounding: number
}

/** How a single column's cost figure was arrived at. */
export type CostSource = 'price-table' | 'estimated' | 'unavailable'

/** Measured or estimated outcome of one anonymised column. */
export interface ColumnResult {
  /** `ok` columns are scored, `failed` columns are excluded from the verdict. */
  state: 'ok' | 'failed'
  /** Wall clock milliseconds measured around the call. */
  latencyMs: number
  tokensIn: number
  tokensOut: number
  /** True when token counts were derived from character counts, not the provider. */
  tokensEstimated: boolean
  costUsd: number | null
  costSource: CostSource
  output: string
  /** Error class only, never provider text. Absent on `ok` columns. */
  errorClass?: TrialErrorClass
  /** Short operator-facing line, for example `check the key for this provider`. */
  errorHint?: string
}

/** Coarse failure classification. Provider messages are never surfaced. */
export type TrialErrorClass = 'provider' | 'status' | 'timeout' | 'auth' | 'empty' | 'unknown'

/** Per-column progress snapshot returned by `trial_status`. */
export interface ColumnStatus {
  letter: Letter
  state: 'pending' | 'running' | 'ok' | 'failed'
  latencyMs: number
  costUsd: number | null
  tokensOut: number
  errorClass?: TrialErrorClass
  errorHint?: string
}

/** The complete verdict assembled after the judge call. */
export interface VerdictReport {
  /** Rubric scores keyed by letter. Failed columns are absent. */
  scores: Record<Letter, RubricScores>
  /** Mean of the five rubric axes, normalised to 0 to 1, keyed by letter. */
  qualityShare: Record<Letter, number>
  costUsd: Record<Letter, number | null>
  latencyMs: Record<Letter, number>
  /**
   * Quality points per cent of a dollar, the value ratio. Null where cost is
   * unavailable, which is every Anna sampling lane.
   */
  valueRatio: Record<Letter, number | null>
  divergences: Array<{ between: [Letter, Letter]; note: string }>
  examinerNotes: string
  /** Free text of the winning column on quality, filled in during assembly. */
  qualityLeader: Letter | null
  /** Free text of the winning column on value, filled in during assembly. */
  valueLeader: Letter | null
  /** Total measured cost across every scored column, in USD. */
  totalCostUsd: number
  /** Milliseconds from the run settling to the verdict being complete. */
  verdictMs: number
  /** Version constant of the price table used for this verdict. */
  priceTableVersion: string
}

/** The persisted trial. One APS key per trial, the mapping lives only here. */
export interface TrialRecord {
  id: string
  createdAt: string
  workload: string
  /** Letter to model identifier. Written before the first call, never exposed early. */
  rosterLetters: Record<Letter, ModelId>
  /** Letter to the label shown after the unblind. */
  rosterLabels: Record<Letter, string>
  /** Letter to source, used for the value ratio and the cost slot. */
  rosterSources: Record<Letter, TrialSource>
  results: Record<Letter, ColumnResult>
  verdict: VerdictReport | null
  crown: { letter: Letter | 'tie'; crownedAt: string } | null
  /** Set once `trial_unblind` has handed the mapping to the UI. */
  unblindedAt: string | null
  /** True when the judge has already scored this trial, blocks a second crown. */
  crowned: boolean
  /** Measured run wall clock, filled in when the run settles. */
  runMs: number
}

/** A compact row for the ledger list. Never carries the letter mapping. */
export interface TrialSummary {
  id: string
  createdAt: string
  workloadExcerpt: string
  /** The crowned column's real name, only when the trial is unblinded. */
  winner: string | null
  /** The crowned column's real name, only when the trial is unblinded. */
  winnerSource: TrialSource | null
  totalCostUsd: number
  letterCount: number
  failedCount: number
  unblinded: boolean
}

/** One per-model moving average fed by every crown. */
export interface ModelWeight {
  quality: number
  costEfficiency: number
  latencyReliability: number
  /** How many crowns have touched this model. */
  observations: number
  /** Share of crowns won, 0 to 1. */
  winShare: number
}

/** Task lanes the user can lock a route for. */
export type TaskType = 'draft' | 'rewrite' | 'extract' | 'code' | 'analyse'

/** Every task lane, in display order. */
export const TASK_TYPES: TaskType[] = ['draft', 'rewrite', 'extract', 'code', 'analyse']

/** The three locked slots per task lane. */
export type LockSlot = 'default' | 'fallback' | 'budget'

/** The three locked slots, in display order. */
export const LOCK_SLOTS: LockSlot[] = ['default', 'fallback', 'budget']

/** Explicit user locks for one task lane. Null means unlocked. */
export type LaneLocks = Record<LockSlot, ModelId | null>

/** The persisted routing policy. One APS key, bumped on every crown. */
export interface PolicyRecord {
  ema: Record<ModelId, ModelWeight>
  rank: ModelId[]
  locks: Record<TaskType, LaneLocks>
  version: number
  crownsRecorded: number
  updatedAt: string
}

/** The price table constant, surfaced in the verdict and bumped on any pricing change. */
export const PRICE_TABLE_VERSION = '2026-09-28.v1'

/** USD per one million tokens, input and output separately. */
export interface ModelPrice {
  inputPerMillion: number
  outputPerMillion: number
}

/** Rate limit window. Six trials per user per hour, held in APS. */
export const TRIAL_RATE_LIMIT = 6
export const TRIAL_RATE_WINDOW_MS = 60 * 60 * 1000

/** Key prefix for the hourly rate limit buckets. */
export const RATE_LIMIT_PREFIX = 'ratelimit/'
