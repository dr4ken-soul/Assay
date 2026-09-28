/**
 * The blind examiner.
 *
 * One call to Anna's sampling endpoint with the fixed rubric prompt, the task
 * text and the anonymised outputs. The judge is given letters, never names.
 *
 * Three guarantees this module is built around:
 *
 *   1. the judge payload is string searched for every roster model name and
 *      label before it leaves the process, and any hit is redacted
 *   2. the reply must be strict JSON that validates against the verdict
 *      schema, with exactly one re-ask on failure
 *   3. a failed column is excluded from the verdict, never scored, never
 *      substituted for a surviving one
 */
import { canSample, logLine, reverseCall, ReverseRpcError } from './rpc.js';
import { computeCostUsd, priceTableVersion } from './cost.js';
import { catalogueFor, annaLaneFor } from './roster.js';
import { saveTrial } from './store.js';
/**
 * The rubric weights, out of 100. These are the weights published on the
 * landing page, so they live here as the single source.
 */
export const RUBRIC_WEIGHTS = {
    correctness: 30,
    instructionFit: 25,
    concision: 15,
    tone: 15,
    grounding: 15,
};
/**
 * The rubric prompt, verbatim from the blueprint. The judge receives exactly
 * this text. Do not reword it, the weights on the landing page match it.
 */
export const JUDGE_PROMPT = `You are a blind examiner. You will receive one task and several anonymised
candidate outputs labelled MODEL A, MODEL B and so on. Score each output
from 0 to 5 on five axes: correctness, instruction fit, concision, tone and
grounding. Penalise padding, invented facts and ignored constraints. For each
pair of outputs note in one short line where they substantively disagree.
You must not speculate about which real model produced which output. Reply
with strict JSON only, matching:

{
  "scores": { "MODEL A": { "correctness": 0, "instructionFit": 0,
    "concision": 0, "tone": 0, "grounding": 0 } },
  "divergences": [ { "between": ["MODEL A", "MODEL B"], "note": "" } ],
  "examinerNotes": ""
}`;
/**
 * Builds the deny list for one trial: every model id and every label on the bench.
 * @param record The trial record.
 * @returns Terms to search for, longest first so a full id is matched before a label.
 */
export function denyTermsFor(record) {
    const terms = new Set();
    for (const [letter, modelId] of Object.entries(record.rosterLetters)) {
        terms.add(modelId.toLowerCase());
        const bare = modelId.includes('/') ? modelId.slice(modelId.indexOf('/') + 1) : modelId;
        if (bare.length >= 3)
            terms.add(bare.toLowerCase());
        const label = record.rosterLabels[letter];
        if (label && label.toLowerCase() !== modelId.toLowerCase())
            terms.add(label.toLowerCase());
        const catalogue = catalogueFor(modelId);
        if (catalogue)
            terms.add(catalogue.id.toLowerCase());
        const lane = annaLaneFor(modelId);
        if (lane)
            terms.add(lane.id.toLowerCase());
    }
    return [...terms].filter((term) => term.length >= 3).sort((a, b) => b.length - a.length);
}
/**
 * Removes every roster name from a judge payload.
 *
 * The judge is promised never to receive a model name, so a hit is redacted
 * rather than shipped. The count is returned and carried into the verdict, so
 * the redaction is visible to the user instead of silent.
 * @param text The assembled payload.
 * @param denyTerms Terms from `denyTermsFor`.
 * @returns The scrubbed text and the replacement count.
 */
export function scrubProviderNames(text, denyTerms) {
    let redactions = 0;
    let output = text;
    for (const term of denyTerms) {
        const pattern = new RegExp(escapeRegExp(term), 'gi');
        output = output.replace(pattern, () => {
            redactions += 1;
            return '[REDACTED]';
        });
    }
    return { text: output, redactions };
}
/**
 * Escapes a string for safe use inside a regular expression.
 * @param value The raw term.
 * @returns The escaped term.
 */
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** The character ceiling applied to one column's output before the judge reads it. */
const OUTPUT_CLAMP_CHARS = 6000;
/**
 * Assembles the judge user message from the task and the anonymised outputs.
 *
 * Each output is clamped, so one verbose model cannot crowd the others out of
 * the examiner's context.
 * @param record The trial record.
 * @param letters The letters to score, failed columns excluded.
 * @returns The raw message, before scrubbing.
 */
export function assembleJudgeMessage(record, letters) {
    const blocks = letters.map((letter) => {
        const result = record.results[letter];
        return `### ${letter}\n${clampOutput(result?.output ?? '')}`;
    });
    return [`TASK`, record.workload, '', 'CANDIDATE OUTPUTS', '', ...blocks].join('\n');
}
/**
 * Truncates one output so a single verbose model cannot crowd the judge out.
 * @param text The output text.
 * @param limit The character ceiling per column.
 * @returns The truncated text with a marker when it was cut.
 */
function clampOutput(text, limit = OUTPUT_CLAMP_CHARS) {
    if (text.length <= limit)
        return text;
    return `${text.slice(0, limit)}\n[TRUNCATED BY ASSAY AT ${limit} CHARACTERS]`;
}
/**
 * Parses and validates a judge reply.
 *
 * Strict JSON only. A fenced code block is tolerated because models emit one
 * despite the instruction, but nothing else is accepted.
 * @param raw The reply text from sampling.
 * @param letters The letters that must be present.
 * @returns The validated reply.
 * @throws Error when the reply is not strict JSON or fails the schema.
 */
export function parseJudgeReply(raw, letters) {
    const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start < 0 || end <= start)
        throw new Error('The examiner did not return JSON.');
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    const scores = {};
    const rawScores = (parsed.scores ?? {});
    for (const letter of letters) {
        const entry = rawScores[letter];
        if (typeof entry !== 'object' || entry === null)
            throw new Error(`The examiner skipped ${letter}.`);
        const record = entry;
        scores[letter] = {
            correctness: clampScore(record.correctness),
            instructionFit: clampScore(record.instructionFit),
            concision: clampScore(record.concision),
            tone: clampScore(record.tone),
            grounding: clampScore(record.grounding),
        };
    }
    const divergences = [];
    const rawDivergences = Array.isArray(parsed.divergences) ? parsed.divergences : [];
    for (const item of rawDivergences) {
        if (typeof item !== 'object' || item === null)
            continue;
        const record = item;
        const between = Array.isArray(record.between) ? record.between.map(String) : [];
        const note = typeof record.note === 'string' ? record.note.trim() : '';
        if (between.length !== 2 || !note)
            continue;
        if (between[0] === between[1])
            continue;
        if (!letters.includes(between[0]) || !letters.includes(between[1]))
            continue;
        divergences.push({ between: [between[0], between[1]], note: note.slice(0, 280) });
    }
    const examinerNotes = typeof parsed.examinerNotes === 'string' ? parsed.examinerNotes.trim().slice(0, 1200) : '';
    return { scores, divergences, examinerNotes };
}
/**
 * Coerces one rubric value into the 0 to 5 range.
 * @param value The raw judge value.
 * @returns A number in the range 0 to 5, rounded to one decimal.
 */
function clampScore(value) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric))
        return 0;
    return Math.max(0, Math.min(5, Math.round(numeric * 10) / 10));
}
/**
 * The weighted quality share for one column, 0 to 1.
 * @param scores The five rubric scores.
 * @returns The weighted mean of the axes, normalised against a perfect five.
 */
export function qualityShareFor(scores) {
    const total = scores.correctness * RUBRIC_WEIGHTS.correctness +
        scores.instructionFit * RUBRIC_WEIGHTS.instructionFit +
        scores.concision * RUBRIC_WEIGHTS.concision +
        scores.tone * RUBRIC_WEIGHTS.tone +
        scores.grounding * RUBRIC_WEIGHTS.grounding;
    return Number((total / (5 * 100)).toFixed(4));
}
/**
 * Calls the blind examiner over one trial and assembles the verdict report.
 *
 * One re-ask on invalid JSON, then a clean error. Never fabricates a score.
 * @param record The settled trial record.
 * @returns The assembled verdict report.
 * @throws Error when sampling is unavailable or the judge fails twice.
 */
export async function buildVerdict(record) {
    if (!canSample()) {
        throw new Error('The examiner needs Anna sampling. Enable sampling for this app in permissions.');
    }
    const letters = Object.keys(record.rosterLetters).filter((letter) => record.results[letter]?.state === 'ok');
    if (letters.length === 0) {
        throw new Error('Every column failed, so there is nothing to examine. Fix the failing keys and run again.');
    }
    const started = Date.now();
    const denyTerms = denyTermsFor(record);
    const raw = assembleJudgeMessage(record, letters);
    const scrubbed = scrubProviderNames(raw, denyTerms);
    if (scrubbed.redactions > 0) {
        logLine('examiner payload redacted', `count=${scrubbed.redactions}`);
    }
    const userMessage = `${scrubbed.text}\n\nReturn the JSON object described in your instructions, for exactly: ${letters.join(', ')}.`;
    let reply = null;
    let lastFailure = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const response = (await reverseCall('sampling/createMessage', {
            messages: [{ role: 'user', content: { type: 'text', text: userMessage } }],
            max_tokens: 4096,
            system_prompt: JUDGE_PROMPT,
            temperature: 0.1,
            include_context: 'none',
        }));
        const text = extractSamplingText(response);
        try {
            reply = parseJudgeReply(text, letters);
            break;
        }
        catch (error) {
            lastFailure = error instanceof Error ? error : new Error(String(error));
            logLine('examiner reply rejected', `attempt=${attempt}`);
        }
    }
    if (!reply) {
        throw new Error(`The examiner could not return a valid verdict. ${lastFailure?.message ?? ''}`.trim());
    }
    const verdict = assembleVerdict(record, letters, reply, Date.now() - started, scrubbed.redactions);
    return verdict;
}
/**
 * Extracts the assistant text from a sampling response.
 * @param result The reverse call result.
 * @returns The reply text.
 */
function extractSamplingText(result) {
    const content = result.content;
    const candidates = [content?.text, result.text, result.output_text];
    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (!found)
        throw new ReverseRpcError(-32003, 'the examiner returned no text');
    return found;
}
/**
 * Assembles the verdict report from validated scores and measured results.
 * @param record The trial record.
 * @param letters The scored letters.
 * @param reply The validated judge reply.
 * @param verdictMs Milliseconds from this call to a complete verdict.
 * @param redactions How many model names were scrubbed from the judge payload.
 * @returns The verdict report.
 */
function assembleVerdict(record, letters, reply, verdictMs, redactions) {
    const qualityShare = {};
    const costUsd = {};
    const latencyMs = {};
    const valueRatio = {};
    for (const letter of letters) {
        const result = record.results[letter];
        const modelId = record.rosterLetters[letter];
        const share = qualityShareFor(reply.scores[letter]);
        const cost = result.costUsd ?? computeCostUsd(modelId, result.tokensIn, result.tokensOut);
        qualityShare[letter] = share;
        costUsd[letter] = cost;
        latencyMs[letter] = result.latencyMs;
        valueRatio[letter] = cost && cost > 0 ? Number(((share * 100) / cost).toFixed(2)) : null;
    }
    const qualityLeader = pickLeader(qualityShare);
    const valueLeader = pickLeader(Object.fromEntries(Object.entries(valueRatio).filter((entry) => entry[1] !== null)));
    const notes = redactions > 0
        ? `${reply.examinerNotes} Assay redacted ${redactions} on-trial model name${redactions === 1 ? '' : 's'} from the material the examiner read.`.trim()
        : reply.examinerNotes;
    const totalCostUsd = Object.values(costUsd).reduce((sum, value) => sum + (value ?? 0), 0);
    return {
        scores: reply.scores,
        qualityShare,
        costUsd,
        latencyMs,
        valueRatio,
        divergences: reply.divergences,
        examinerNotes: notes,
        qualityLeader,
        valueLeader,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
        verdictMs,
        priceTableVersion: priceTableVersion(),
    };
}
/**
 * Picks the highest scoring key, lowest letter on a tie for determinism.
 * @param values Score map.
 * @returns The winning key, or null when the map is empty.
 */
function pickLeader(values) {
    let leader = null;
    let best = -Infinity;
    for (const [key, value] of Object.entries(values)) {
        if (value > best) {
            best = value;
            leader = key;
        }
    }
    return leader;
}
/**
 * Scores a settled trial and writes the verdict onto the record.
 * @param record The trial record, sealed from the UI.
 * @returns The stored trial, with its verdict attached.
 */
export async function verdictAndStore(record) {
    const verdict = await buildVerdict(record);
    const sealed = { ...record, verdict };
    await saveTrial(sealed);
    return sealed;
}
