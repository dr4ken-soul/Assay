/**
 * A fake host client, shaped exactly like the Anna SDK surface the bundle uses.
 *
 * Every test drives the views through this, so a view is never tested against a
 * different contract than it will meet in the window.
 */

import { installHostClient, type HostClient } from '../src/lib/host'
import type {
  ColumnStatus,
  Letter,
  PolicyView,
  RosterEntry,
  TrialDetail,
  TrialStarted,
  TrialStatus,
  TrialSummary,
  TrialUnblind,
  TrialVerdict,
} from '../src/lib/types'

/** The roster the tests run against, deliberately full of distinctive names. */
export const ROSTER: RosterEntry[] = [
  { id: 'openai/gpt-4o', provider: 'openai', label: 'GPT-4o', source: 'byok', hasKey: true },
  { id: 'anthropic/claude-sonnet-4.5', provider: 'anthropic', label: 'Claude Sonnet 4.5', source: 'byok', hasKey: true },
  { id: 'xai/grok-4', provider: 'xai', label: 'Grok 4', source: 'byok', hasKey: true },
  { id: 'anna/speed', provider: 'anna', label: 'Anna, speed lane', source: 'anna', hasKey: true },
]

/** Every string in the roster that must never reach the DOM before the reveal. */
export const FORBIDDEN_BEFORE_UNBLIND = [
  'GPT-4o',
  'gpt-4o',
  'Claude Sonnet 4.5',
  'claude-sonnet-4.5',
  'Grok 4',
  'grok-4',
  'openai',
  'anthropic',
  'xai',
  'Anna, speed lane',
  'anna/speed',
]

/**
 * Builds a status payload with one failed column, the FAILED column case.
 * @param letters The letters in run order.
 * @returns A settled status.
 */
export function settledStatus(letters: Letter[]): TrialStatus {
  const columns: ColumnStatus[] = letters.map((letter, index) =>
    index === 2
      ? { letter, state: 'failed', latencyMs: 0, costUsd: null, tokensOut: 0, errorClass: 'auth', errorHint: 'the key for this provider was rejected, check it in Anna settings' }
      : { letter, state: 'ok', latencyMs: 1200 + index * 400, costUsd: 0.0008 + index * 0.0004, tokensOut: 120 + index * 30 },
  )
  return { trialId: 't_test', state: 'settled', letters, columns, runMs: 2400, stored: true }
}

/**
 * Builds a running status payload.
 * @param letters The letters in run order.
 * @returns A running status.
 */
export function runningStatus(letters: Letter[]): TrialStatus {
  const columns: ColumnStatus[] = letters.map((letter, index) =>
    index === 2
      ? { letter, state: 'failed', latencyMs: 0, costUsd: null, tokensOut: 0, errorClass: 'auth', errorHint: 'the key for this provider was rejected, check it in Anna settings' }
      : { letter, state: index === 0 ? 'ok' : 'running', latencyMs: index === 0 ? 1200 : 0, costUsd: index === 0 ? 0.0008 : null, tokensOut: index === 0 ? 120 : 0 },
  )
  return { trialId: 't_test', state: 'running', letters, columns, runMs: 1200, stored: true }
}

/**
 * Builds a verdict payload covering every letter but the failed one.
 * @param letters The letters in run order.
 * @returns A verdict response.
 */
export function verdictFor(letters: Letter[]): TrialVerdict {
  const scored = letters.filter((letter) => letter !== letters[2])
  const scores: TrialVerdict['verdict']['scores'] = {}
  const costUsd: TrialVerdict['verdict']['costUsd'] = {}
  const latencyMs: TrialVerdict['verdict']['latencyMs'] = {}
  const valueRatio: TrialVerdict['verdict']['valueRatio'] = {}
  const qualityShare: TrialVerdict['verdict']['qualityShare'] = {}
  scored.forEach((letter, index) => {
    scores[letter] = { correctness: 4 - index * 0.5, instructionFit: 5 - index, concision: 4, tone: 4, grounding: 3 + index * 0.5 }
    costUsd[letter] = 0.0008 + index * 0.0004
    latencyMs[letter] = 1200 + index * 400
    valueRatio[letter] = 1000 - index * 120
    qualityShare[letter] = 0.82 - index * 0.12
  })
  return {
    trialId: 't_test',
    failed: 1,
    verdict: {
      scores,
      qualityShare,
      costUsd,
      latencyMs,
      valueRatio,
      divergences: scored.length >= 2 ? [{ between: [scored[0], scored[1]], note: 'one keeps the constraint, the other drops it' }] : [],
      examinerNotes: 'Both answers are usable. One honours the length limit.',
      qualityLeader: scored[0] ?? null,
      valueLeader: scored[0] ?? null,
      totalCostUsd: 0.002,
      verdictMs: 1400,
      priceTableVersion: '2026-09-28.v1',
    },
  }
}

/** The reveal payload, only ever returned after a crown. */
export const UNBLIND: TrialUnblind = {
  trialId: 't_test',
  revealed: [
    { letter: 'MODEL A', label: 'Claude Sonnet 4.5', modelId: 'anthropic/claude-sonnet-4.5', source: 'byok' },
    { letter: 'MODEL B', label: 'GPT-4o', modelId: 'openai/gpt-4o', source: 'byok' },
    { letter: 'MODEL C', label: 'Grok 4', modelId: 'xai/grok-4', source: 'byok' },
  ],
  crowned: 'MODEL A',
  workload: 'Summarise the incident for a customer.',
}

/** A ledger with one unblinded trial and one still sealed. */
export const LEDGER: TrialSummary[] = [
  { id: 't_old', createdAt: '2026-09-20T09:15:00.000Z', workloadExcerpt: 'Summarise the incident for a customer.', winner: 'Claude Sonnet 4.5', winnerSource: 'byok', totalCostUsd: 0.002, letterCount: 3, failedCount: 0, unblinded: true },
  { id: 't_sealed', createdAt: '2026-09-24T14:02:00.000Z', workloadExcerpt: 'Rewrite the changelog entry for release notes.', winner: null, winnerSource: null, totalCostUsd: 0.0011, letterCount: 2, failedCount: 0, unblinded: false },
]

/** A full ledger record for the still sealed trial, names withheld. */
export const SEALED_DETAIL: TrialDetail = {
  id: 't_sealed',
  createdAt: '2026-09-24T14:02:00.000Z',
  workload: 'Rewrite the changelog entry for release notes.',
  unblinded: false,
  results: {
    'MODEL A': { state: 'ok', latencyMs: 1500, tokensIn: 80, tokensOut: 90, tokensEstimated: false, costUsd: 0.0006, costSource: 'price-table', output: 'Rewritten entry.' },
    'MODEL B': { state: 'ok', latencyMs: 1900, tokensIn: 80, tokensOut: 70, tokensEstimated: false, costUsd: 0.0005, costSource: 'price-table', output: 'Rewritten entry, longer.' },
  },
  verdict: {
    scores: { 'MODEL A': { correctness: 4, instructionFit: 4, concision: 5, tone: 4, grounding: 4 }, 'MODEL B': { correctness: 4, instructionFit: 3, concision: 3, tone: 4, grounding: 3 } },
    qualityShare: { 'MODEL A': 0.84, 'MODEL B': 0.72 },
    costUsd: { 'MODEL A': 0.0006, 'MODEL B': 0.0005 },
    latencyMs: { 'MODEL A': 1500, 'MODEL B': 1900 },
    valueRatio: { 'MODEL A': 1400, 'MODEL B': 1440 },
    divergences: [{ between: ['MODEL A', 'MODEL B'], note: 'one keeps the past tense' }],
    examinerNotes: 'Close.',
    qualityLeader: 'MODEL A',
    valueLeader: 'MODEL B',
    totalCostUsd: 0.0011,
    verdictMs: 1100,
    priceTableVersion: '2026-09-28.v1',
  },
  crown: { letter: 'MODEL A', crownedAt: '2026-09-24T14:03:00.000Z' },
  runMs: 1900,
  revealed: [],
}

/** A policy with two crowned models and one lock. */
export const POLICY: PolicyView = {
  version: 3,
  crownsRecorded: 3,
  updatedAt: '2026-09-28T10:00:00.000Z',
  rows: [
    { rank: 1, modelId: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', composite: 0.71, quality: 0.84, costEfficiency: 0.4, latencyReliability: 0.7, observations: 3, winShare: 0.66, lockedIn: ['draft'] },
    { rank: 2, modelId: 'openai/gpt-4o', label: 'GPT-4o', composite: 0.52, quality: 0.71, costEfficiency: 0.6, latencyReliability: 0.55, observations: 2, winShare: 0.33, lockedIn: [] },
  ],
  locks: {
    draft: { default: 'anthropic/claude-sonnet-4.5', fallback: null, budget: null },
    rewrite: { default: null, fallback: null, budget: null },
    extract: { default: null, fallback: null, budget: null },
    code: { default: null, fallback: null, budget: null },
    analyse: { default: null, fallback: null, budget: null },
  },
  routing: {
    draft: { default: 'anthropic/claude-sonnet-4.5', fallback: 'openai/gpt-4o', budget: 'openai/gpt-4o' },
    rewrite: { default: 'anthropic/claude-sonnet-4.5', fallback: 'openai/gpt-4o', budget: 'openai/gpt-4o' },
    extract: { default: 'anthropic/claude-sonnet-4.5', fallback: 'openai/gpt-4o', budget: 'openai/gpt-4o' },
    code: { default: 'anthropic/claude-sonnet-4.5', fallback: 'openai/gpt-4o', budget: 'openai/gpt-4o' },
    analyse: { default: 'anthropic/claude-sonnet-4.5', fallback: 'openai/gpt-4o', budget: 'openai/gpt-4o' },
  },
}

/** A record of every tool call the views made, so a test can assert on it. */
export interface CallLog {
  method: string
  args: Record<string, unknown>
}

/** Everything the fake client needs to answer, plus the call log. */
export interface FakeHost {
  client: HostClient
  calls: CallLog[]
  /** Fails the next call of this method with a rate limit. */
  rateLimit: (method: string) => void
  /** Fails the next call of this method with a generic failure. */
  fail: (method: string) => void
}

/**
 * Builds a fake host client.
 * @param letters The letters the trial will assign, used by the run handlers.
 * @returns The client plus its call log and failure controls.
 */
export function makeFakeHost(letters: Letter[] = ['MODEL A', 'MODEL B', 'MODEL C']): FakeHost {
  const calls: CallLog[] = []
  const rateLimited = new Set<string>()
  const failed = new Set<string>()

  const started: TrialStarted = { trialId: 't_test', letters, startedAt: '2026-09-28T10:00:00.000Z', rosterCount: letters.length }
  let statusPolls = 0

  const client: HostClient = {
    viewMeta: { name: 'bench', title: 'Assay' },
    setTitle: async () => undefined,
    invoke: async <T,>(method: string, args: Record<string, unknown>): Promise<T> => {
      calls.push({ method, args })
      if (rateLimited.delete(method)) {
        return { success: false, error: 'Rate limit reached.', data: { code: 'rate_limited', resetsAt: '2026-09-28T11:00:00.000Z' } } as T
      }
      if (failed.delete(method)) {
        return { success: false, error: 'The examiner could not return a valid verdict.', data: { code: 'tool_failed' } } as T
      }
      switch (method) {
        case 'roster_list':
          return { success: true, data: { roster: ROSTER } } as T
        case 'trial_start':
          return { success: true, data: started } as T
        case 'trial_status':
          statusPolls += 1
          return { success: true, data: statusPolls < 3 ? runningStatus(letters) : settledStatus(letters) } as T
        case 'trial_verdict':
          return { success: true, data: verdictFor(letters) } as T
        case 'trial_crown':
          return { success: true, data: { trialId: 't_test', crowned: 'MODEL A', recorded: true, policy: { version: 4, crownsRecorded: 4, rank: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o'] } } } as T
        case 'trial_unblind':
          return { success: true, data: UNBLIND } as T
        case 'history_list':
          return { success: true, data: { trials: LEDGER, total: LEDGER.length } } as T
        case 'history_get':
          return { success: true, data: { trial: SEALED_DETAIL } } as T
        case 'policy_get':
        case 'policy_set_lock':
          return { success: true, data: POLICY } as T
        case 'policy_export':
          return { success: true, data: { json: '{\n  "format": "assay.routing-policy"\n}', version: 3 } } as T
        default:
          throw new Error(`fake host has no handler for ${method}`)
      }
    },
  }

  return {
    client,
    calls,
    rateLimit: (method) => rateLimited.add(method),
    fail: (method) => failed.add(method),
  }
}

/**
 * Installs a fake host and returns the teardown.
 * @param host The fake host to install.
 * @returns Nothing, the caller unmounts and calls installHostClient(null).
 */
export function useFakeHost(host: FakeHost): void {
  installHostClient(host.client)
}
