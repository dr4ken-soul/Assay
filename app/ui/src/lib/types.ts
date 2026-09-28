/**
 * Types mirroring the Executa's JSON contract.
 *
 * Kept in the bundle rather than imported from the tool, because the bundle is
 * uploaded to the host as static files and cannot resolve a workspace import.
 * The two files are changed together; `test/contract.test.ts` asserts the tool
 * method names still match.
 */

/** Identifier of a model on the bench. */
export type ModelId = string

/** Where a column's call is billed. */
export type TrialSource = 'byok' | 'anna'

/** One row of the roster. Carries a boolean key status, never a key. */
export interface RosterEntry {
  id: ModelId
  provider: string
  label: string
  source: TrialSource
  hasKey: boolean
}

/** Anonymised column key, for example `MODEL A`. */
export type Letter = string

/** The five rubric axes, each from 0 to 5. */
export interface RubricScores {
  correctness: number
  instructionFit: number
  concision: number
  tone: number
  grounding: number
}

/** Coarse failure classification for a FAILED column. */
export type TrialErrorClass = 'provider' | 'status' | 'timeout' | 'auth' | 'empty' | 'unknown'

/** Live or settled state of one column. */
export interface ColumnStatus {
  letter: Letter
  state: 'pending' | 'running' | 'ok' | 'failed'
  latencyMs: number
  costUsd: number | null
  tokensOut: number
  errorClass?: TrialErrorClass
  errorHint?: string
}

/** The measured outcome of one column, sealed inside the tool. */
export interface ColumnResult {
  state: 'ok' | 'failed'
  latencyMs: number
  tokensIn: number
  tokensOut: number
  tokensEstimated: boolean
  costUsd: number | null
  costSource: 'price-table' | 'estimated' | 'unavailable'
  output: string
  errorClass?: TrialErrorClass
  errorHint?: string
}

/** The complete verdict. */
export interface VerdictReport {
  scores: Record<Letter, RubricScores>
  qualityShare: Record<Letter, number>
  costUsd: Record<Letter, number | null>
  latencyMs: Record<Letter, number>
  valueRatio: Record<Letter, number | null>
  divergences: Array<{ between: [Letter, Letter]; note: string }>
  examinerNotes: string
  qualityLeader: Letter | null
  valueLeader: Letter | null
  totalCostUsd: number
  verdictMs: number
  priceTableVersion: string
}

/** The task lanes a route can be locked for. */
export type TaskType = 'draft' | 'rewrite' | 'extract' | 'code' | 'analyse'

/** The three locked slots per lane. */
export type LockSlot = 'default' | 'fallback' | 'budget'

/** Every task lane, in display order. */
export const TASK_TYPES: TaskType[] = ['draft', 'rewrite', 'extract', 'code', 'analyse']

/** The three slots, in display order. */
export const LOCK_SLOTS: LockSlot[] = ['default', 'fallback', 'budget']

/** Explicit user locks for one lane. Null means unlocked. */
export type LaneLocks = Record<LockSlot, ModelId | null>

/** The start response. Letters only, never the mapping. */
export interface TrialStarted {
  trialId: string
  letters: Letter[]
  startedAt: string
  rosterCount: number
}

/** The live status response. */
export interface TrialStatus {
  trialId: string
  state: 'running' | 'settled'
  letters: Letter[]
  columns: ColumnStatus[]
  runMs: number
  stored: boolean
}

/** The verdict response. */
export interface TrialVerdict {
  trialId: string
  verdict: VerdictReport
  failed: number
}

/** One revealed column, only ever returned after the crown. */
export interface RevealedColumn {
  letter: Letter
  label: string
  modelId: ModelId
  source: TrialSource
}

/** The unblind response. */
export interface TrialUnblind {
  trialId: string
  revealed: RevealedColumn[]
  crowned: Letter | 'tie' | null
  workload: string
}

/** The crown response. */
export interface TrialCrown {
  trialId: string
  crowned: Letter | 'tie'
  recorded: boolean
  policy: { version: number; crownsRecorded: number; rank: ModelId[] }
}

/** A compact ledger row. Never carries the mapping. */
export interface TrialSummary {
  id: string
  createdAt: string
  workloadExcerpt: string
  winner: string | null
  winnerSource: TrialSource | null
  totalCostUsd: number
  letterCount: number
  failedCount: number
  unblinded: boolean
}

/** One row of the policy ranking. */
export interface PolicyRow {
  rank: number
  modelId: ModelId
  label: string
  composite: number
  quality: number
  costEfficiency: number
  latencyReliability: number
  observations: number
  winShare: number
  lockedIn: TaskType[]
}

/** The policy screen payload. */
export interface PolicyView {
  version: number
  crownsRecorded: number
  updatedAt: string
  rows: PolicyRow[]
  locks: Record<TaskType, LaneLocks>
  routing: Record<TaskType, LaneLocks>
}

/** A full ledger record, names only once unblinded. */
export interface TrialDetail {
  id: string
  createdAt: string
  workload: string
  unblinded: boolean
  results: Record<Letter, ColumnResult>
  verdict: VerdictReport | null
  crown: { letter: Letter | 'tie'; crownedAt: string } | null
  runMs: number
  revealed: RevealedColumn[]
}

/** The five rubric axes in display order, with their published weights. */
export const RUBRIC_AXES: Array<{ key: keyof RubricScores; label: string; weight: number }> = [
  { key: 'correctness', label: 'Correctness', weight: 30 },
  { key: 'instructionFit', label: 'Instruction fit', weight: 25 },
  { key: 'concision', label: 'Concision', weight: 15 },
  { key: 'tone', label: 'Tone', weight: 15 },
  { key: 'grounding', label: 'Grounding', weight: 15 },
]
