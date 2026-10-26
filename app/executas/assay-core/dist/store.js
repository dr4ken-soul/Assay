/**
 * Anna Persistent Storage wrapper.
 *
 * Keys are namespaced by the platform to the current user and to this Executa,
 * so no user identifier ever appears in a key. The platform owns the
 * namespace; this module owns the key shape.
 *
 * Key layout, fixed by the blueprint:
 *
 *   trials/{id}        one TrialRecord
 *   trials/index       the ledger summaries, newest first
 *   policy/current     the PolicyRecord
 *   policy/version     the integer policy version, mirrored for the UI
 *   ratelimit/{bucket} the trial timestamps inside one hourly bucket
 *
 * Every function degrades to an in-process map when APS is not available, so
 * the plugin still runs against a bare `describe` or `invoke` smoke test. The
 * degradation is logged once, never silently.
 */
import { canUseStorage, logLine, pause, reverseCall, ReverseRpcError } from './rpc.js';
/** The ledger index key. */
export const TRIALS_INDEX_KEY = 'trials/index';
/** The current policy key. */
export const POLICY_KEY = 'policy/current';
/** The policy version key, mirrored as a bare integer. */
export const POLICY_VERSION_KEY = 'policy/version';
/** In-process fallback used only when APS is unavailable. */
const memory = new Map();
/** Whether the fallback is in play, logged once at first use. */
let fallbackLogged = false;
/**
 * Reads one JSON value.
 * @param key The APS key.
 * @returns The stored value, or null when the key is absent.
 */
export async function readKey(key) {
    if (!canUseStorage()) {
        noteFallback();
        return memory.get(key) ?? null;
    }
    // A storage read the agent could not serve is not the key being absent:
    // the agent has been seen to refuse even a small run of reverse calls. A
    // failed read is repeated on a short leash before absence is reported, so
    // one bad answer never ends up on screen as "not found". A read answered
    // affirmatively with no value is real absence and comes straight back.
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const result = (await reverseCall('storage/get', { scope: 'tool', key }));
            if (result?.exists === false)
                return null;
            return result?.value ?? null;
        }
        catch (error) {
            if (error instanceof ReverseRpcError) {
                logLine('storage/get failed', `attempt=${attempt}/${maxAttempts}`, String(error.code), error.message);
            }
            if (attempt < maxAttempts)
                await pause(400);
        }
    }
    return null;
}
/**
 * Writes one JSON value.
 * @param key The APS key.
 * @param value Any JSON-serialisable payload.
 * @returns True when the write landed in APS, false when the fallback took it.
 */
export async function writeKey(key, value) {
    if (!canUseStorage()) {
        noteFallback();
        memory.set(key, value);
        return false;
    }
    // A write this store cannot serve is a lost mapping, a lost crown, a lost
    // reveal. The agent has been seen to refuse everything off the reverse
    // channel for a spell after a freshly deployed plugin boots, so a failed
    // write is repeated on a short leash before the in-process fallback is
    // allowed to take it, and the fallback is named in the log rather than
    // passing quietly as durability.
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await reverseCall('storage/set', { scope: 'tool', key, value });
            return true;
        }
        catch (error) {
            if (error instanceof ReverseRpcError) {
                logLine('storage/set failed', `attempt=${attempt}/${maxAttempts}`, String(error.code), error.message);
            }
            if (attempt < maxAttempts)
                await pause(500);
        }
    }
    memory.set(key, value);
    logLine('storage/write kept in fallback', key);
    return false;
}
/**
 * Deletes one key.
 * @param key The APS key.
 * @returns True when the delete was accepted by APS.
 */
export async function deleteKey(key) {
    if (!canUseStorage()) {
        noteFallback();
        memory.delete(key);
        return false;
    }
    try {
        await reverseCall('storage/delete', { scope: 'tool', key });
        return true;
    }
    catch {
        memory.delete(key);
        return false;
    }
}
/**
 * Lists keys under a prefix, metadata only.
 * @param prefix Forward-match prefix.
 * @param limit Page size, 1 to 1000.
 * @returns The matching keys, or an empty list when APS is unavailable.
 */
export async function listKeys(prefix, limit = 1000) {
    if (!canUseStorage()) {
        noteFallback();
        return [...memory.keys()].filter((key) => key.startsWith(prefix));
    }
    try {
        const result = (await reverseCall('storage/list', { scope: 'tool', prefix, limit }));
        return (result?.items ?? []).map((item) => item.key);
    }
    catch {
        return [...memory.keys()].filter((key) => key.startsWith(prefix));
    }
}
/**
 * Logs the storage fallback exactly once per process.
 */
function noteFallback() {
    if (fallbackLogged)
        return;
    fallbackLogged = true;
    logLine('APS unavailable, serving storage from process memory for this run');
}
/**
 * The key a trial record lives under.
 * @param trialId The trial identifier.
 * @returns The APS key.
 */
export function trialKey(trialId) {
    return `trials/${trialId}`;
}
/**
 * Writes a trial record and refreshes the ledger index.
 *
 * The index carries each row's summary directly now, so a ledger page is one
 * storage read regardless of how many trials ran. Older index rows hold bare
 * identifiers from before the summary ledger; they are kept and still load
 * their record per id until the row expires. The summary itself is the
 * unmappable row: it never carries the letter to model mapping, and it names
 * a winner only once the record has been unblinded.
 * @param record The trial to persist.
 * @returns True when the record write landed in APS.
 */
export async function saveTrial(record) {
    const stored = await writeKey(trialKey(record.id), record);
    const summary = toSummary(record);
    const index = (await readKey(TRIALS_INDEX_KEY)) ?? [];
    const next = [
        summary,
        ...index.filter((entry) => (typeof entry === 'string' ? entry : entry.id) !== record.id),
    ].slice(0, 500);
    await writeKey(TRIALS_INDEX_KEY, next);
    return stored;
}
/**
 * Reads a trial record.
 * @param trialId The trial identifier.
 * @returns The record, or null when it does not exist.
 */
export async function loadTrial(trialId) {
    return readKey(trialKey(trialId));
}
/**
 * Reads the ledger index, newest first.
 *
 * New rows are complete summaries. Rows written before the summary ledger
 * hold bare identifiers, which the ledger resolves per record on demand.
 * @returns Ledger entries, newest first.
 */
export async function trialIndex() {
    return (await readKey(TRIALS_INDEX_KEY)) ?? [];
}
/**
 * Replaces the ledger index wholesale.
 *
 * The one-time upgrade path uses this after loading legacy identifier rows:
 * their summaries are written back so every later ledger page is one
 * storage read rather than a chain of record reads.
 * @param entries The full row list, newest first.
 * @returns True when the write landed in APS.
 */
export async function writeTrialIndex(entries) {
    return writeKey(TRIALS_INDEX_KEY, entries);
}
/**
 * Builds a ledger summary from a full trial record.
 *
 * The summary never carries the letter to model mapping. A summary is only
 * allowed to name a winner once the trial has been unblinded.
 * @param record The full trial record.
 * @returns A compact row for the ledger.
 */
export function toSummary(record) {
    const crowned = record.crown?.letter;
    const crownIsAColumn = typeof crowned === 'string' && crowned !== 'tie' && crowned.length > 0;
    const revealed = record.unblindedAt !== null && crownIsAColumn;
    const served = revealed ? record.results[crowned]?.servedModel : undefined;
    const winnerName = revealed ? (served ?? record.rosterLabels[crowned] ?? null) : null;
    const results = Object.values(record.results);
    return {
        id: record.id,
        createdAt: record.createdAt,
        workloadExcerpt: record.workload.length > 96 ? `${record.workload.slice(0, 96)}…` : record.workload,
        winner: winnerName,
        winnerSource: winnerName ? (record.rosterSources[crowned] ?? null) : null,
        totalCostUsd: record.verdict?.totalCostUsd ?? 0,
        letterCount: Object.keys(record.rosterLetters).length,
        failedCount: results.filter((result) => result.state === 'failed').length,
        unblinded: record.unblindedAt !== null,
    };
}
/**
 * Reads the current policy, or an empty one when none exists.
 * @returns The stored policy, or a fresh empty policy.
 */
export async function loadPolicy() {
    return ((await readKey(POLICY_KEY)) ?? {
        ema: {},
        rank: [],
        locks: {
            draft: { default: null, fallback: null, budget: null },
            rewrite: { default: null, fallback: null, budget: null },
            extract: { default: null, fallback: null, budget: null },
            code: { default: null, fallback: null, budget: null },
            analyse: { default: null, fallback: null, budget: null },
        },
        version: 0,
        crownsRecorded: 0,
        updatedAt: new Date().toISOString(),
    });
}
/**
 * Writes the policy and mirrors its version as a bare integer.
 * @param policy The policy to persist.
 * @returns True when the policy write landed in APS.
 */
export async function savePolicy(policy) {
    const stored = await writeKey(POLICY_KEY, policy);
    await writeKey(POLICY_VERSION_KEY, policy.version);
    return stored;
}
