/**
 * The routing policy engine.
 *
 * Every crown feeds three per-model exponential moving averages: quality
 * share, cost efficiency and latency reliability. An unused model decays, so
 * the policy tracks what the user is actually choosing rather than what they
 * chose once.
 *
 * Locks are the user's explicit word per task lane. A lock always wins over a
 * computed rank, because a user who has told Assay where a lane goes has said
 * something the data cannot improve on.
 *
 * The exported JSON is the whole policy, and importing it reproduces the same
 * ranking. There is no second format.
 */
import { loadPolicy, savePolicy } from './store.js';
import { labelFor } from './roster.js';
import { LOCK_SLOTS, TASK_TYPES } from './types.js';
/** The EMA smoothing factor. Higher reacts faster, lower is steadier. */
const ALPHA = 0.35;
/** The decay applied to a model that did not appear in a crown. */
const DECAY = 0.9;
/** A model with no observations yet sorts below any model that has one. */
function emptyWeight() {
    return { quality: 0, costEfficiency: 0, latencyReliability: 0, observations: 0, winShare: 0 };
}
/**
 * Blends one measured sample into a moving average.
 * @param current The current average.
 * @param sample The new sample.
 * @param alpha The smoothing factor.
 * @returns The blended average.
 */
function ema(current, sample, alpha) {
    return current + alpha * (sample - current);
}
/**
 * The composite score a rank sorts on.
 *
 * Quality leads, value and latency follow. Weights live here as the single
 * source so the ranking is reproducible from the export.
 * @param weight One model's moving averages.
 * @returns The composite, 0 to 1.
 */
export function compositeScore(weight) {
    if (weight.observations === 0)
        return 0;
    return Number((weight.quality * 0.6 + weight.costEfficiency * 0.25 + weight.latencyReliability * 0.15).toFixed(6));
}
/**
 * Normalises a cost sample to 0 to 1 against the most expensive column in the trial.
 *
 * The cheapest column on trial scores 1. A column with no cost, which is every
 * Anna sampling lane, scores 0 for cost efficiency and is ranked on quality and
 * latency alone rather than being quietly rewarded.
 * @param costUsd This column's cost.
 * @param maxCost The most expensive scored column in the trial.
 * @returns The cost efficiency sample, 0 to 1.
 */
export function costEfficiencySample(costUsd, maxCost) {
    if (costUsd === null || maxCost <= 0)
        return 0;
    if (costUsd <= 0)
        return 1;
    return Number((1 - costUsd / maxCost).toFixed(6));
}
/**
 * Normalises a latency sample to 0 to 1 against the slowest column in the trial.
 * @param latencyMs This column's latency.
 * @param maxLatencyMs The slowest scored column in the trial.
 * @returns The latency reliability sample, 0 to 1.
 */
export function latencyReliabilitySample(latencyMs, maxLatencyMs) {
    if (maxLatencyMs <= 0)
        return 1;
    return Number((1 - latencyMs / maxLatencyMs).toFixed(6));
}
/**
 * Folds one crown into the policy.
 *
 * Every model on the bench gets a sample from the verdict, not just the
 * winner, so the policy learns what the crown beat. The winner also gets its
 * win share bumped. Models absent from this trial decay.
 * @param policy The current policy.
 * @param trial The crowned trial, with its verdict.
 * @returns A new policy. The input is not mutated.
 */
export function applyCrown(policy, trial) {
    if (!trial.verdict)
        throw new Error('A crown needs a verdict.');
    const weights = {};
    for (const [modelId, weight] of Object.entries(policy.ema)) {
        weights[modelId] = { ...weight };
    }
    const entries = Object.entries(trial.rosterLetters);
    for (const [, modelId] of entries) {
        if (!weights[modelId])
            weights[modelId] = emptyWeight();
    }
    const letters = entries.map(([letter]) => letter);
    const costs = letters
        .map((letter) => trial.verdict?.costUsd[letter] ?? null)
        .filter((value) => value !== null);
    const latencies = letters.map((letter) => trial.verdict?.latencyMs[letter] ?? 0);
    const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const crowned = trial.crown?.letter;
    const onBench = new Set(entries.map(([, modelId]) => modelId));
    for (const [letter, modelId] of entries) {
        const weight = weights[modelId];
        const quality = trial.verdict?.qualityShare[letter];
        if (quality === undefined)
            continue;
        weight.quality = Number(ema(weight.quality, quality, ALPHA).toFixed(6));
        weight.costEfficiency = Number(ema(weight.costEfficiency, costEfficiencySample(trial.verdict?.costUsd[letter] ?? null, maxCost), ALPHA).toFixed(6));
        weight.latencyReliability = Number(ema(weight.latencyReliability, latencyReliabilitySample(trial.verdict?.latencyMs[letter] ?? 0, maxLatency), ALPHA).toFixed(6));
        weight.observations += 1;
        const wins = crowned === letter ? 1 : 0;
        weight.winShare = Number(((weight.winShare * (weight.observations - 1) + wins) / weight.observations).toFixed(6));
    }
    for (const [modelId, weight] of Object.entries(weights)) {
        if (onBench.has(modelId) || weight.observations === 0)
            continue;
        weight.quality = Number((weight.quality * DECAY).toFixed(6));
        weight.costEfficiency = Number((weight.costEfficiency * DECAY).toFixed(6));
        weight.latencyReliability = Number((weight.latencyReliability * DECAY).toFixed(6));
    }
    const rank = Object.entries(weights)
        .filter(([, weight]) => weight.observations > 0)
        .sort((a, b) => compositeScore(b[1]) - compositeScore(a[1]) || a[0].localeCompare(b[0]))
        .map(([modelId]) => modelId);
    return {
        ema: weights,
        rank,
        locks: policy.locks,
        version: policy.version + 1,
        crownsRecorded: policy.crownsRecorded + 1,
        updatedAt: new Date().toISOString(),
    };
}
/**
 * Records a crown and rewrites the policy.
 * @param trial The crowned trial, with its verdict.
 * @returns The updated policy.
 */
export async function recordCrown(trial) {
    const policy = await loadPolicy();
    const next = applyCrown(policy, trial);
    await savePolicy(next);
    return next;
}
/**
 * Sets or clears one lock.
 * @param task The task lane.
 * @param slot The locked slot.
 * @param modelId The model to lock, or null to unlock.
 * @returns The updated policy.
 */
export async function setLock(task, slot, modelId) {
    if (!TASK_TYPES.includes(task))
        throw new Error(`Unknown task type: ${task}`);
    if (!LOCK_SLOTS.includes(slot))
        throw new Error(`Unknown lock slot: ${slot}`);
    const policy = await loadPolicy();
    const locks = { ...policy.locks };
    locks[task] = { ...(locks[task] ?? { default: null, fallback: null, budget: null }), [slot]: modelId };
    const next = {
        ...policy,
        locks,
        version: policy.version + 1,
        updatedAt: new Date().toISOString(),
    };
    await savePolicy(next);
    return next;
}
/**
 * Builds the policy screen payload.
 * @param policy The stored policy.
 * @returns Ranked rows and the header counters.
 */
export function policyView(policy) {
    const rankIndex = new Map(policy.rank.map((modelId, index) => [modelId, index + 1]));
    const rows = Object.entries(policy.ema)
        .map(([modelId, weight]) => ({
        rank: rankIndex.get(modelId) ?? 0,
        modelId,
        label: labelFor(modelId),
        composite: compositeScore(weight),
        quality: weight.quality,
        costEfficiency: weight.costEfficiency,
        latencyReliability: weight.latencyReliability,
        observations: weight.observations,
        winShare: weight.winShare,
        lockedIn: TASK_TYPES.filter((task) => {
            const lane = policy.locks[task];
            return lane.default === modelId || lane.fallback === modelId || lane.budget === modelId;
        }),
    }))
        .sort((a, b) => b.composite - a.composite || a.label.localeCompare(b.label));
    const routing = {};
    for (const task of TASK_TYPES) {
        const lane = policy.locks[task] ?? { default: null, fallback: null, budget: null };
        routing[task] = {
            default: lane.default ?? policy.rank[0] ?? null,
            fallback: lane.fallback ?? policy.rank[1] ?? null,
            budget: lane.budget ?? policy.rank[policy.rank.length - 1] ?? null,
        };
    }
    return {
        version: policy.version,
        crownsRecorded: policy.crownsRecorded,
        updatedAt: policy.updatedAt,
        rows,
        locks: policy.locks,
        routing,
    };
}
/**
 * Serialises the policy as plain JSON.
 *
 * The export is a superset of the stored record, so reloading it through the
 * policy import path reproduces the same ranking.
 * @param policy The stored policy.
 * @returns The export object.
 */
export function exportPolicy(policy) {
    const view = policyView(policy);
    return {
        format: 'assay.routing-policy',
        formatVersion: 1,
        policyVersion: policy.version,
        crownsRecorded: policy.crownsRecorded,
        exportedAt: new Date().toISOString(),
        priceTableVersion: policy.version > 0 ? 'see the verdict that seeded this policy' : 'not yet seeded',
        weights: { quality: 0.6, costEfficiency: 0.25, latencyReliability: 0.15 },
        rank: view.rows.map((row) => ({
            modelId: row.modelId,
            label: row.label,
            composite: row.composite,
            quality: row.quality,
            observations: row.observations,
        })),
        locks: policy.locks,
        routing: view.routing,
    };
}
/**
 * Serialises the policy to the string the UI copies.
 * @param policy The stored policy.
 * @returns Pretty printed JSON.
 */
export function exportPolicyJson(policy) {
    return JSON.stringify(exportPolicy(policy), null, 2);
}
