/**
 * The versioned price table.
 *
 * One source file, one version constant. Any change to provider pricing is a
 * meaningful maintenance commit that bumps `PRICE_TABLE_VERSION`, so a stored
 * verdict always states which table priced it.
 *
 * Prices are USD per one million tokens, input and output billed separately.
 * A model missing from this table is never estimated: its cost is `null` and
 * its value ratio is `null`. An assay that invents a price is worse than one
 * that admits it does not know.
 */
import { PRICE_TABLE_VERSION } from './types.js';
/**
 * Prices in USD per one million tokens, keyed by lowercase model id.
 *
 * Sources are the providers' published list prices. Recheck and bump
 * `PRICE_TABLE_VERSION` whenever any figure here changes.
 */
const PRICE_TABLE = {
    'openai/gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
    'openai/gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
    'openai/gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
    'openai/gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
    'openai/gpt-4.1-nano': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
    'openai/o3-mini': { inputPerMillion: 1.1, outputPerMillion: 4.4 },
    'openai/gpt-5': { inputPerMillion: 1.25, outputPerMillion: 10 },
    'openai/gpt-5-mini': { inputPerMillion: 0.25, outputPerMillion: 2 },
    'anthropic/claude-sonnet-4.5': { inputPerMillion: 3, outputPerMillion: 15 },
    'anthropic/claude-opus-4.1': { inputPerMillion: 15, outputPerMillion: 75 },
    'anthropic/claude-haiku-4.5': { inputPerMillion: 1, outputPerMillion: 5 },
    'anthropic/claude-3-5-haiku': { inputPerMillion: 0.8, outputPerMillion: 4 },
    'google/gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
    'google/gemini-2.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
    'google/gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
    'mistral/large-latest': { inputPerMillion: 2, outputPerMillion: 6 },
    'mistral/small-latest': { inputPerMillion: 0.2, outputPerMillion: 0.6 },
    'xai/grok-4': { inputPerMillion: 3, outputPerMillion: 15 },
    'xai/grok-3-mini': { inputPerMillion: 0.3, outputPerMillion: 0.5 },
    'groq/llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
    'groq/llama-3.1-8b-instant': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
    'openrouter/auto': { inputPerMillion: 1, outputPerMillion: 3 },
    'deepseek/deepseek-chat': { inputPerMillion: 0.27, outputPerMillion: 1.1 },
};
/**
 * Average characters per token for the fallback estimator.
 *
 * Deliberately conservative across English prose, code and JSON. The estimate
 * is always flagged as an estimate in the record, never presented as measured.
 */
const CHARS_PER_TOKEN = 4;
/**
 * Estimates a token count from character length.
 * @param text The text to measure. Empty text is zero tokens.
 * @returns An estimated token count, never a measured one.
 */
export function estimateTokens(text) {
    return Math.max(0, Math.round(text.length / CHARS_PER_TOKEN));
}
/**
 * Looks up the price row for a model.
 * @param modelId The model identifier, matched case insensitively.
 * @returns The price row, or null when the table has no row for this model.
 */
export function priceFor(modelId) {
    return PRICE_TABLE[modelId.trim().toLowerCase()] ?? null;
}
/**
 * Computes the cost of one call from its token counts.
 * @param modelId The model identifier.
 * @param tokensIn Measured or estimated prompt tokens.
 * @param tokensOut Measured or estimated completion tokens.
 * @returns Cost in USD, or null when the price table has no row.
 */
export function computeCostUsd(modelId, tokensIn, tokensOut) {
    const price = priceFor(modelId);
    if (!price)
        return null;
    const cost = (tokensIn / 1_000_000) * price.inputPerMillion + (tokensOut / 1_000_000) * price.outputPerMillion;
    return Number(cost.toFixed(6));
}
/**
 * Computes a provisional cost for the live running view, where only the input
 * side has been spent so far. Used for the accruing figure only.
 * @param modelId The model identifier.
 * @param tokensIn Tokens spent on the prompt so far.
 * @returns Cost in USD, or null when the price table has no row.
 */
export function computeRunningCostUsd(modelId, tokensIn) {
    const price = priceFor(modelId);
    if (!price)
        return null;
    return Number(((tokensIn / 1_000_000) * price.inputPerMillion).toFixed(6));
}
/**
 * The price table version stamped into every verdict.
 * @returns The current version constant.
 */
export function priceTableVersion() {
    return PRICE_TABLE_VERSION;
}
/**
 * The model identifiers this table can price.
 * @returns Every key in the price table.
 */
export function pricedModels() {
    return Object.keys(PRICE_TABLE);
}
