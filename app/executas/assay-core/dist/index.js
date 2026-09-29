/**
 * assay-core, the Assay Executa.
 *
 * One bundled tool, eleven methods. The UI never calls a model directly: it
 * calls one of these methods through the host API and this process does the
 * work, so latency and token cost are measured server side.
 *
 * Method surface, one per ToolDefinition in the manifest below:
 *
 *   roster_list        models on the bench, with a boolean key status
 *   trial_start        shuffle, assign letters, persist the mapping, run
 *   trial_status       per-letter state and live timers
 *   trial_verdict      the blind examiner, then cost and value assembly
 *   trial_unblind      the letter to model mapping, refuses before a verdict
 *   trial_crown        the user's blind choice, writes the ledger, moves the policy
 *   history_list       ledger summaries, newest first
 *   history_get        one full record, post unblind only
 *   policy_get         weights, rank, locks, version
 *   policy_set_lock    default, fallback and budget per task type
 *   policy_export      the policy as a JSON string
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logLine, setForwardHandler, setInvokeHandler, startTransport } from './rpc.js';
import { CREDENTIAL_SCHEMA, listRoster } from './roster.js';
import { RateLimitError, startTrial, trialStatus } from './trial.js';
import { verdictAndStore } from './judge.js';
import { exportPolicyJson, policyView, recordCrown, setLock } from './policy.js';
import { loadPolicy, loadTrial, toSummary, trialIndex } from './store.js';
import { TASK_TYPES } from './types.js';
/**
 * The tool id, read from the sibling `executa.json` when it is on disk.
 *
 * The platform mints the id and it is the same string in four places: the CLI
 * discovery file, `describe.name`, `manifest.required_executas` and
 * `ui.host_api.tools`. Reading the discovery file here means the plugin can
 * never disagree with the file the CLI launches it from, which is the failure
 * mode that produces a Stopped card and a silent `tools.invoke` timeout.
 * @returns The tool id, or the built-in default when the file is not readable.
 */
function resolveToolId() {
    const candidates = [
        // fileURLToPath, not URL.pathname: pathname is percent-encoded and carries a
        // leading slash on Windows, so readFileSync cannot open it and the lookup
        // would silently fall through to the built-in default.
        fileURLToPath(new URL('../executa.json', import.meta.url)),
        join(process.cwd(), 'executa.json'),
    ];
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
            if (typeof parsed.tool_id === 'string' && parsed.tool_id.length > 0)
                return parsed.tool_id;
        }
        catch {
            /* try the next candidate */
        }
    }
    return DEFAULT_TOOL_ID;
}
/** The built-in tool id, used only when `executa.json` is not readable. */
const DEFAULT_TOOL_ID = 'tool-dev-assay';
/** The tool id this process is running as. */
const TOOL_ID = resolveToolId();
/**
 * The plugin version, read from the sibling `package.json`.
 *
 * It is a literal in neither the manifest nor `health`, because a hardcoded
 * version silently drifts from the version the platform has frozen and then
 * reports the wrong one in execution traces.
 * @returns The SemVer string, or `0.0.0` when the file is unreadable.
 */
function resolveVersion() {
    const candidates = [
        fileURLToPath(new URL('../package.json', import.meta.url)),
        join(process.cwd(), 'package.json'),
    ];
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
            if (typeof parsed.version === 'string' && parsed.version.length > 0)
                return parsed.version;
        }
        catch {
            /* try the next candidate */
        }
    }
    return '0.0.0';
}
/** The version this plugin reports through describe and health. */
const VERSION = resolveVersion();
/** The plugin manifest returned by `describe`. */
const MANIFEST = {
    name: TOOL_ID,
    display_name: 'Assay',
    version: VERSION,
    description: 'Blind trial bench for model selection. Runs one workload across every model on the bench in parallel with the names shuffled to letters, scores the anonymised outputs with a blind examiner, measures token cost and latency, then reveals which model earned which column and folds the crown into a personal routing policy.',
    author: 'Assay',
    host_capabilities: ['llm.sample', 'aps.kv'],
    runtime: { type: 'npm' },
    credentials: CREDENTIAL_SCHEMA,
    tools: [
        {
            name: 'roster_list',
            description: 'List the models this user can put on trial right now, each with a boolean flag for whether a provider key is present. Never returns key material.',
            parameters: [],
            timeout: 15000,
        },
        {
            name: 'trial_start',
            description: 'Start a blind trial. Shuffles the roster, assigns MODEL A, MODEL B and so on, seals the mapping, then runs every column in parallel. Returns the trial id and the letters in run order. Costs real credits, six trials per hour.',
            parameters: [
                { name: 'workload', type: 'string', description: 'The real workload to run, task text plus any input.', required: true },
                {
                    name: 'roster_ids',
                    type: 'array',
                    items: { type: 'string' },
                    items_type: 'string',
                    description: 'Roster identifiers from roster_list, at least two.',
                    required: true,
                },
            ],
            timeout: 30000,
        },
        {
            name: 'trial_status',
            description: 'Read live per-column state and timers for a running trial. Never returns model names.',
            parameters: [{ name: 'trial_id', type: 'string', description: 'The trial id from trial_start.', required: true }],
            timeout: 15000,
        },
        {
            name: 'trial_verdict',
            description: 'Score the anonymised outputs with the blind examiner and return the verdict: rubric scores, token cost, latency, value ratio and divergence notes. The examiner never receives model names.',
            parameters: [{ name: 'trial_id', type: 'string', description: 'The trial id to examine.', required: true }],
            timeout: 180000,
        },
        {
            name: 'trial_crown',
            description: "Record the user's blind choice for a trial, either a letter or the tie. Writes the trial record to storage and shifts the routing policy. Refuses after the blind has been lifted.",
            parameters: [
                { name: 'trial_id', type: 'string', description: 'The trial id to crown.', required: true },
                { name: 'letter', type: 'string', description: 'The winning column, for example MODEL A, or the word tie.', required: true },
            ],
            timeout: 30000,
        },
        {
            name: 'trial_unblind',
            description: 'Reveal the letter to model mapping for a crowned trial. Refuses before a crown, so the choice stays unbiased.',
            parameters: [{ name: 'trial_id', type: 'string', description: 'The trial id to reveal.', required: true }],
            timeout: 15000,
        },
        {
            name: 'history_list',
            description: 'List the user trial ledger, newest first, with a cap on the page size.',
            parameters: [{ name: 'limit', type: 'integer', description: 'How many rows to return, 1 to 200.', required: false, default: 50 }],
            timeout: 20000,
        },
        {
            name: 'history_get',
            description: 'Read one full trial record from the ledger. Names are only present once the trial is unblinded.',
            parameters: [{ name: 'trial_id', type: 'string', description: 'The trial id to read.', required: true }],
            timeout: 15000,
        },
        {
            name: 'policy_get',
            description: 'Read the routing policy: per-model weights, computed rank, per-task-type locks and version.',
            parameters: [],
            timeout: 15000,
        },
        {
            name: 'policy_set_lock',
            description: 'Lock or unlock one routing slot for one task type. Pass a null model to unlock. A lock always wins over the computed rank.',
            parameters: [
                { name: 'task', type: 'string', description: 'One of draft, rewrite, extract, code, analyse.', required: true, enum: TASK_TYPES },
                { name: 'slot', type: 'string', description: 'One of default, fallback, budget.', required: true, enum: ['default', 'fallback', 'budget'] },
                { name: 'model_id', type: 'string', description: 'The model to lock, or null to unlock.', required: false },
            ],
            timeout: 15000,
        },
        {
            name: 'policy_export',
            description: 'Export the routing policy as a JSON string, ready to drop into a user own agents and scripts.',
            parameters: [],
            timeout: 15000,
        },
    ],
};
/** The `describe` result, including the per-tool host view. */
function describe() {
    return MANIFEST;
}
/** The `health` result. */
function health() {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: VERSION,
        tool_id: TOOL_ID,
        tools_count: MANIFEST.tools.length,
    };
}
/**
 * Reads a required string argument.
 * @param args The invoke arguments.
 * @param key The argument name.
 * @returns The trimmed string value.
 * @throws Error when the argument is missing or not a string.
 */
function requireString(args, key) {
    const value = args[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw Object.assign(new Error(`Missing argument: ${key}`), { code: -32602 });
    }
    return value.trim();
}
/**
 * Loads a trial and refuses when it is not in the state the method requires.
 * @param trialId The trial identifier.
 * @param requirement What the caller needs the trial to have.
 * @returns The trial record.
 * @throws Error when the trial is missing or does not meet the requirement.
 */
async function loadTrialFor(trialId, requirement) {
    const record = await loadTrial(trialId);
    if (!record)
        throw new Error('Trial not found. It may have been cleared from storage.');
    if (requirement === 'verdict' && !record.verdict)
        throw new Error('This trial has no verdict yet. Wait for the examiner.');
    if (requirement === 'crown' && record.crowned)
        throw new Error('This trial is already crowned. The choice is on the record.');
    if (requirement === 'unblind') {
        if (!record.verdict)
            throw new Error('This trial has no verdict yet, there is nothing to reveal.');
        if (!record.crowned)
            throw new Error('Crown a winner first. The reveal is meant to be a surprise.');
    }
    return record;
}
/**
 * Runs one tool method and returns its payload.
 * @param tool The method name from the manifest.
 * @param args The invoke arguments.
 * @param context The per-invoke context, used for the run counter only.
 * @returns The tool payload.
 */
async function runTool(tool, args, context) {
    switch (tool) {
        case 'roster_list':
            return { roster: await listRoster() };
        case 'trial_start': {
            const workload = requireString(args, 'workload');
            const rosterIds = Array.isArray(args.roster_ids) ? args.roster_ids.map(String) : [];
            const started = await startTrial(workload, rosterIds);
            return { ...started, rosterCount: rosterIds.length, invokeId: context.invokeId };
        }
        case 'trial_status':
            return trialStatus(requireString(args, 'trial_id'));
        case 'trial_verdict': {
            const record = await loadTrialFor(requireString(args, 'trial_id'), 'verdict');
            const sealed = await verdictAndStore(record);
            return { trialId: sealed.id, verdict: sealed.verdict, failed: Object.values(sealed.results).filter((result) => result.state === 'failed').length };
        }
        case 'trial_crown': {
            const record = await loadTrialFor(requireString(args, 'trial_id'), 'crown');
            const raw = requireString(args, 'letter');
            const letter = raw.toLowerCase() === 'tie' ? 'tie' : raw.toUpperCase();
            if (letter !== 'tie' && !record.rosterLetters[letter]) {
                throw new Error(`No column called ${letter} in this trial.`);
            }
            if (letter !== 'tie' && record.results[letter]?.state === 'failed') {
                throw new Error('That column failed, it cannot be crowned. Crown another or call it a tie.');
            }
            const crowned = { ...record, crown: { letter, crownedAt: new Date().toISOString() }, crowned: true };
            const { saveTrial } = await import('./store.js');
            await saveTrial(crowned);
            const policy = await recordCrown(crowned);
            return {
                trialId: crowned.id,
                crowned: letter,
                recorded: true,
                policy: { version: policy.version, crownsRecorded: policy.crownsRecorded, rank: policy.rank },
            };
        }
        case 'trial_unblind': {
            const record = await loadTrialFor(requireString(args, 'trial_id'), 'unblind');
            const revealed = { ...record, unblindedAt: new Date().toISOString() };
            const { saveTrial } = await import('./store.js');
            await saveTrial(revealed);
            return {
                trialId: revealed.id,
                revealed: Object.entries(revealed.rosterLabels).map(([letter, label]) => ({
                    letter,
                    label,
                    modelId: revealed.rosterLetters[letter],
                    source: revealed.rosterSources[letter],
                })),
                crowned: revealed.crown?.letter ?? null,
                workload: revealed.workload,
            };
        }
        case 'history_list': {
            const limitRaw = args.limit;
            const limit = typeof limitRaw === 'number' && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 50;
            const ids = await trialIndex();
            const rows = [];
            for (const id of ids.slice(0, limit)) {
                const record = await loadTrial(id);
                if (record)
                    rows.push(toSummary(record));
            }
            return { trials: rows, total: ids.length };
        }
        case 'history_get': {
            const record = await loadTrial(requireString(args, 'trial_id'));
            if (!record)
                throw new Error('Trial not found. It may have been cleared from storage.');
            const revealed = record.unblindedAt !== null;
            return {
                trial: {
                    id: record.id,
                    createdAt: record.createdAt,
                    workload: record.workload,
                    unblinded: revealed,
                    results: record.results,
                    verdict: record.verdict,
                    crown: record.crown,
                    runMs: record.runMs,
                    revealed: revealed
                        ? Object.entries(record.rosterLabels).map(([letter, label]) => ({
                            letter,
                            label,
                            modelId: record.rosterLetters[letter],
                            source: record.rosterSources[letter],
                        }))
                        : [],
                },
            };
        }
        case 'policy_get': {
            const policy = await loadPolicy();
            return policyView(policy);
        }
        case 'policy_set_lock': {
            const task = requireString(args, 'task');
            const slot = requireString(args, 'slot');
            const modelId = typeof args.model_id === 'string' && args.model_id.length > 0 ? args.model_id : null;
            const policy = await setLock(task, slot, modelId);
            return policyView(policy);
        }
        case 'policy_export': {
            const policy = await loadPolicy();
            return { json: exportPolicyJson(policy), version: policy.version };
        }
        default:
            throw Object.assign(new Error(`unknown tool: ${tool}`), { code: -32601 });
    }
}
/** The result envelope for a user facing failure the UI should render. */
function failure(message, extra = {}) {
    return { success: false, error: message, ...extra };
}
setForwardHandler((method, params) => {
    if (method === 'describe')
        return describe();
    if (method === 'health')
        return health();
    throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
});
setInvokeHandler(async (params, context) => {
    const tool = String(params.tool ?? '');
    const args = (params.arguments ?? {});
    const started = Date.now();
    try {
        const data = await runTool(tool, args, context);
        logLine('ok', tool, `${Date.now() - started}ms`);
        return { success: true, data, tool };
    }
    catch (error) {
        if (error instanceof RateLimitError) {
            logLine('rate limited', tool);
            return { success: false, error: error.message, data: { code: 'rate_limited', limit: error.limit, resetsAt: error.resetsAt }, tool };
        }
        const message = error instanceof Error ? error.message : String(error);
        const code = error.code;
        logLine('failed', tool, code ? String(code) : 'error');
        if (code === -32601)
            throw error;
        return failure(message, { data: { code: 'tool_failed' }, tool });
    }
});
startTransport();
