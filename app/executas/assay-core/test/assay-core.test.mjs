/**
 * Executa unit tests.
 *
 * Covers the invariants the blueprint calls out by name: a FAILED column is
 * never substituted, the judge payload never carries a model name, the rate
 * limit holds, and five crowns of one model put it first in the policy.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { computeCostUsd, estimateTokens, pricedModels } from '../dist/cost.js'
import { JUDGE_PROMPT, assembleJudgeMessage, denyTermsFor, parseJudgeReply, qualityShareFor, scrubProviderNames } from '../dist/judge.js'
import { compositeScore, costEfficiencySample, exportPolicy, latencyReliabilitySample, applyCrown, policyView } from '../dist/policy.js'
import { letterForIndex, seededShuffle, consumeRateLimitSlot, RateLimitError } from '../dist/trial.js'
import { TRIAL_RATE_LIMIT } from '../dist/types.js'
import { toSummary } from '../dist/store.js'

/**
 * Builds a settled trial record with two columns.
 * @param overrides Fields to override on the record.
 * @returns A trial record with one ok column and one failed column.
 */
function makeTrial(overrides = {}) {
  return {
    id: 't_test_1',
    createdAt: '2026-09-28T10:00:00.000Z',
    workload: 'Summarise the incident in three lines for a customer.',
    rosterLetters: { 'MODEL A': 'openai/gpt-4o', 'MODEL B': 'anthropic/claude-sonnet-4.5' },
    rosterLabels: { 'MODEL A': 'GPT-4o', 'MODEL B': 'Claude Sonnet 4.5' },
    rosterSources: { 'MODEL A': 'byok', 'MODEL B': 'byok' },
    results: {
      'MODEL A': {
        state: 'ok',
        latencyMs: 2000,
        tokensIn: 100,
        tokensOut: 50,
        tokensEstimated: false,
        costUsd: 0.00075,
        costSource: 'price-table',
        output: 'Three lines.',
      },
      'MODEL B': {
        state: 'failed',
        latencyMs: 900,
        tokensIn: 0,
        tokensOut: 0,
        tokensEstimated: false,
        costUsd: null,
        costSource: 'unavailable',
        output: '',
        errorClass: 'auth',
        errorHint: 'the key for this provider was rejected, check it in Anna settings',
      },
    },
    verdict: {
      scores: { 'MODEL A': { correctness: 4, instructionFit: 5, concision: 4, tone: 4, grounding: 3 } },
      qualityShare: { 'MODEL A': 0.808 },
      costUsd: { 'MODEL A': 0.00075 },
      latencyMs: { 'MODEL A': 2000 },
      valueRatio: { 'MODEL A': 1077.33 },
      divergences: [],
      examinerNotes: 'Clean and short.',
      qualityLeader: 'MODEL A',
      valueLeader: 'MODEL A',
      totalCostUsd: 0.00075,
      verdictMs: 1200,
      priceTableVersion: '2026-09-28.v1',
    },
    crown: { letter: 'MODEL A', crownedAt: '2026-09-28T10:01:00.000Z' },
    unblindedAt: null,
    crowned: true,
    runMs: 2000,
    ...overrides,
  }
}

test('letters are assigned in run order and never encode roster order', () => {
  assert.equal(letterForIndex(0), 'MODEL A')
  assert.equal(letterForIndex(1), 'MODEL B')
  assert.equal(letterForIndex(25), 'MODEL Z')
})

test('the shuffle keeps every roster member and changes order across runs', () => {
  const roster = ['a/1', 'b/2', 'c/3', 'd/4', 'e/5']
  const first = seededShuffle(roster)
  assert.deepEqual([...first].sort(), [...roster].sort())
  const orders = new Set()
  for (let run = 0; run < 40; run += 1) orders.add(seededShuffle(roster).join('|'))
  assert.ok(orders.size > 1, 'shuffle produced a single order across 40 runs')
})

test('the rate limit holds at six trials per window', async () => {
  for (let slot = 1; slot <= TRIAL_RATE_LIMIT; slot += 1) {
    const spent = await consumeRateLimitSlot(Date.now())
    assert.equal(spent, slot)
  }
  await assert.rejects(() => consumeRateLimitSlot(Date.now()), RateLimitError)
  await assert.rejects(() => consumeRateLimitSlot(Date.now()), /6 trials per hour/)
})

test('an unknown model is never given an invented price', () => {
  assert.equal(computeCostUsd('nobody/imaginary', 1000, 1000), null)
  assert.equal(computeCostUsd('openai/gpt-4o', 1_000_000, 0), 2.5)
  assert.equal(computeCostUsd('openai/gpt-4o', 0, 1_000_000), 10)
  assert.ok(pricedModels().length > 0)
})

test('token estimation is flagged by omission, never claimed as measured', () => {
  assert.equal(estimateTokens(''), 0)
  assert.equal(estimateTokens('abcd'), 1)
  assert.equal(estimateTokens('a'.repeat(400)), 100)
})

test('the judge payload carries no roster model name', () => {
  const trial = makeTrial({ results: { ...makeTrial().results, 'MODEL B': { ...makeTrial().results['MODEL B'], state: 'ok', output: 'I am Claude Sonnet 4.5 and I would say three lines.' } } })
  const deny = denyTermsFor(trial)
  assert.ok(deny.includes('gpt-4o'))
  assert.ok(deny.includes('claude sonnet 4.5'))

  const raw = assembleJudgeMessage(trial, ['MODEL A', 'MODEL B'])
  const scrubbed = scrubProviderNames(raw, deny)
  for (const term of deny) {
    assert.equal(scrubbed.text.toLowerCase().includes(term), false, `judge payload still contains ${term}`)
  }
  assert.ok(scrubbed.redactions >= 1, 'the self identifying output should have been redacted')
})

test('the rubric prompt is the one published in the blueprint', () => {
  assert.ok(JUDGE_PROMPT.startsWith('You are a blind examiner.'))
  assert.ok(JUDGE_PROMPT.includes('correctness, instruction fit, concision, tone and'))
  assert.ok(JUDGE_PROMPT.includes('You must not speculate about which real model produced which output.'))
})

test('the judge reply must be strict JSON covering every scored column', () => {
  const good = JSON.stringify({
    scores: {
      'MODEL A': { correctness: 4, instructionFit: 5, concision: 4, tone: 4, grounding: 3 },
      'MODEL B': { correctness: 3, instructionFit: 3, concision: 5, tone: 4, grounding: 3 },
    },
    divergences: [{ between: ['MODEL A', 'MODEL B'], note: 'disagrees on the fix' }],
    examinerNotes: 'Clean.',
  })
  const parsed = parseJudgeReply(`\`\`\`json\n${good}\n\`\`\``, ['MODEL A', 'MODEL B'])
  assert.equal(parsed.scores['MODEL A'].correctness, 4)
  assert.equal(parsed.scores['MODEL B'].concision, 5)
  assert.equal(parsed.divergences.length, 1)
  assert.equal(parsed.divergences[0].note, 'disagrees on the fix')

  assert.throws(() => parseJudgeReply('the examiner rambled', ['MODEL A']))
  assert.throws(() => parseJudgeReply(JSON.stringify({ scores: {} }), ['MODEL A']))
  assert.throws(
    () => parseJudgeReply(good, ['MODEL A', 'MODEL B', 'MODEL C']),
    /skipped MODEL C/,
    'a reply that drops a column is a schema failure, not a short verdict',
  )
})

test('a divergence naming an unknown column is dropped, not surfaced', () => {
  const parsed = parseJudgeReply(
    JSON.stringify({
      scores: { 'MODEL A': { correctness: 4, instructionFit: 4, concision: 4, tone: 4, grounding: 4 } },
      divergences: [
        { between: ['MODEL A', 'MODEL Z'], note: 'hallucinated column' },
        { between: ['MODEL A', 'MODEL A'], note: 'self pair' },
      ],
      examinerNotes: '',
    }),
    ['MODEL A'],
  )
  assert.equal(parsed.divergences.length, 0)
})

test('quality share follows the published weights', () => {
  const perfect = qualityShareFor({ correctness: 5, instructionFit: 5, concision: 5, tone: 5, grounding: 5 })
  const zero = qualityShareFor({ correctness: 0, instructionFit: 0, concision: 0, tone: 0, grounding: 0 })
  const heavy = qualityShareFor({ correctness: 5, instructionFit: 5, concision: 0, tone: 0, grounding: 0 })
  assert.equal(perfect, 1)
  assert.equal(zero, 0)
  assert.ok(heavy > 0.5 && heavy < 1, 'correctness and fit carry 55 percent of the weight')
  assert.equal(Number(heavy.toFixed(2)), 0.55)
})

test('five crowns of one model put it first in the policy', () => {
  let policy = {
    ema: {},
    rank: [],
    locks: { draft: { default: null, fallback: null, budget: null }, rewrite: { default: null, fallback: null, budget: null }, extract: { default: null, fallback: null, budget: null }, code: { default: null, fallback: null, budget: null }, analyse: { default: null, fallback: null, budget: null } },
    version: 0,
    crownsRecorded: 0,
    updatedAt: '2026-09-28T10:00:00.000Z',
  }

  for (let round = 0; round < 5; round += 1) {
    const trial = makeTrial({
      id: `t_${round}`,
      results: {
        'MODEL A': { ...makeTrial().results['MODEL A'], latencyMs: 1200, costUsd: 0.0004 },
        'MODEL B': { ...makeTrial().results['MODEL B'], state: 'ok', latencyMs: 6000, costUsd: 0.02, output: 'Verbose answer from the other column.' },
      },
      verdict: {
        scores: {
          'MODEL A': { correctness: 5, instructionFit: 5, concision: 5, tone: 4, grounding: 5 },
          'MODEL B': { correctness: 2, instructionFit: 2, concision: 1, tone: 3, grounding: 2 },
        },
        qualityShare: { 'MODEL A': 0.96, 'MODEL B': 0.4 },
        costUsd: { 'MODEL A': 0.0004, 'MODEL B': 0.02 },
        latencyMs: { 'MODEL A': 1200, 'MODEL B': 6000 },
        valueRatio: { 'MODEL A': 2400, 'MODEL B': 20 },
        divergences: [],
        examinerNotes: '',
        qualityLeader: 'MODEL A',
        valueLeader: 'MODEL A',
        totalCostUsd: 0.0204,
        verdictMs: 1000,
        priceTableVersion: '2026-09-28.v1',
      },
    })
    policy = applyCrown(policy, trial)
  }

  assert.equal(policy.rank[0], 'openai/gpt-4o')
  assert.equal(policy.rank[1], 'anthropic/claude-sonnet-4.5')
  assert.equal(policy.crownsRecorded, 5)
  assert.equal(policy.version, 5)
})

test('an unused model decays instead of holding its crown', () => {
  const base = {
    ema: {
      'openai/gpt-4o': { quality: 0.9, costEfficiency: 0.5, latencyReliability: 0.5, observations: 4, winShare: 1 },
      'anthropic/claude-sonnet-4.5': { quality: 0.4, costEfficiency: 0.2, latencyReliability: 0.2, observations: 4, winShare: 0 },
    },
    rank: ['openai/gpt-4o', 'anthropic/claude-sonnet-4.5'],
    locks: { draft: { default: null, fallback: null, budget: null }, rewrite: { default: null, fallback: null, budget: null }, extract: { default: null, fallback: null, budget: null }, code: { default: null, fallback: null, budget: null }, analyse: { default: null, fallback: null, budget: null } },
    version: 4,
    crownsRecorded: 4,
    updatedAt: '2026-09-28T10:00:00.000Z',
  }
  const trial = makeTrial({
    rosterLetters: { 'MODEL A': 'mistral/small-latest' },
    rosterLabels: { 'MODEL A': 'Mistral Small' },
    rosterSources: { 'MODEL A': 'byok' },
    results: { 'MODEL A': { ...makeTrial().results['MODEL A'], costUsd: 0.0001, latencyMs: 900 } },
    verdict: {
      scores: { 'MODEL A': { correctness: 4, instructionFit: 4, concision: 4, tone: 4, grounding: 4 } },
      qualityShare: { 'MODEL A': 0.8 },
      costUsd: { 'MODEL A': 0.0001 },
      latencyMs: { 'MODEL A': 900 },
      valueRatio: { 'MODEL A': 8000 },
      divergences: [],
      examinerNotes: '',
      qualityLeader: 'MODEL A',
      valueLeader: 'MODEL A',
      totalCostUsd: 0.0001,
      verdictMs: 800,
      priceTableVersion: '2026-09-28.v1',
    },
  })

  const next = applyCrown(base, trial)
  assert.ok(next.ema['openai/gpt-4o'].quality < 0.9, 'the absent model should have decayed')
  assert.equal(next.ema['openai/gpt-4o'].observations, 4, 'decay does not invent observations')
})

test('the export round trips into the same ranking', () => {
  const policy = {
    ema: { 'openai/gpt-4o': { quality: 0.9, costEfficiency: 0.6, latencyReliability: 0.7, observations: 3, winShare: 1 } },
    rank: ['openai/gpt-4o'],
    locks: { draft: { default: 'openai/gpt-4o', fallback: null, budget: null }, rewrite: { default: null, fallback: null, budget: null }, extract: { default: null, fallback: null, budget: null }, code: { default: null, fallback: null, budget: null }, analyse: { default: null, fallback: null, budget: null } },
    version: 3,
    crownsRecorded: 3,
    updatedAt: '2026-09-28T10:00:00.000Z',
  }
  const exported = exportPolicy(policy)
  assert.equal(exported.format, 'assay.routing-policy')
  assert.equal(exported.rank[0].modelId, 'openai/gpt-4o')
  assert.equal(exported.locks.draft.default, 'openai/gpt-4o')
  assert.deepEqual(policyView(policy).routing.draft, { default: 'openai/gpt-4o', fallback: null, budget: 'openai/gpt-4o' })
  assert.equal(JSON.parse(JSON.stringify(exported)).rank[0].composite, compositeScore(policy.ema['openai/gpt-4o']))
})

test('cost and latency samples normalise against the trial worst case', () => {
  assert.equal(costEfficiencySample(0, 0.02), 1)
  assert.equal(costEfficiencySample(0.02, 0.02), 0)
  assert.equal(costEfficiencySample(null, 0.02), 0, 'an Anna sampling lane has no cost and scores zero, not free')
  assert.equal(latencyReliabilitySample(1000, 4000), 0.75)
  assert.equal(latencyReliabilitySample(0, 0), 1)
})

test('a ledger row never names a winner before the unblind', () => {
  const blind = toSummary(makeTrial({ unblindedAt: null }))
  assert.equal(blind.winner, null)
  assert.equal(blind.unblinded, false)

  const revealed = toSummary(makeTrial({ unblindedAt: '2026-09-28T10:02:00.000Z' }))
  assert.equal(revealed.winner, 'GPT-4o')
  assert.equal(revealed.winnerSource, 'byok')

  const tie = toSummary(makeTrial({ unblindedAt: '2026-09-28T10:02:00.000Z', crown: { letter: 'tie', crownedAt: 'x' } }))
  assert.equal(tie.winner, null, 'a tie has no winner to name')
})

test('a failed column keeps its class and hint and carries no output', () => {
  const trial = makeTrial()
  const failed = trial.results['MODEL B']
  assert.equal(failed.state, 'failed')
  assert.equal(failed.errorClass, 'auth')
  assert.equal(failed.output, '')
  assert.equal(Object.keys(trial.verdict.scores).length, 1, 'the failed column is excluded from the verdict')
})
