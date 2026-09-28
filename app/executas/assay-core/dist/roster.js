/**
 * Model discovery and key status.
 *
 * A roster entry is a model the user can put on trial. The entry carries a
 * boolean `hasKey`, never the key. Credential values are read from the
 * request scoped invoke context and are never logged, returned, cached or
 * written to storage.
 *
 * Two sources feed the roster:
 *
 *   byok  a provider whose credential Anna has injected for this invoke
 *   anna  a sampling lane, billed by Anna on the user's own credits
 *
 * The sampling lanes are soft routing hints. The host resolves the concrete
 * model behind a hint and reports it back, and that resolved name is written
 * to the trial record but only ever shown after the unblind.
 */
import { canSample, currentInvokeContext } from './rpc.js';
/**
 * The provider catalogue.
 *
 * One entry per BYOK provider. Add a model here and it appears on the bench
 * for every user who holds that provider's key.
 */
const PROVIDERS = [
    {
        credential: 'OPENAI_API_KEY',
        provider: 'openai',
        models: [
            { id: 'openai/gpt-5', provider: 'openai', label: 'GPT-5', maxOutputTokens: 4096 },
            { id: 'openai/gpt-5-mini', provider: 'openai', label: 'GPT-5 mini', maxOutputTokens: 4096 },
            { id: 'openai/gpt-4.1', provider: 'openai', label: 'GPT-4.1', maxOutputTokens: 4096 },
            { id: 'openai/gpt-4.1-mini', provider: 'openai', label: 'GPT-4.1 mini', maxOutputTokens: 4096 },
            { id: 'openai/gpt-4o', provider: 'openai', label: 'GPT-4o', maxOutputTokens: 4096 },
            { id: 'openai/gpt-4o-mini', provider: 'openai', label: 'GPT-4o mini', maxOutputTokens: 4096 },
        ],
    },
    {
        credential: 'ANTHROPIC_API_KEY',
        provider: 'anthropic',
        models: [
            { id: 'anthropic/claude-sonnet-4.5', provider: 'anthropic', label: 'Claude Sonnet 4.5', maxOutputTokens: 4096 },
            { id: 'anthropic/claude-opus-4.1', provider: 'anthropic', label: 'Claude Opus 4.1', maxOutputTokens: 4096 },
            { id: 'anthropic/claude-haiku-4.5', provider: 'anthropic', label: 'Claude Haiku 4.5', maxOutputTokens: 4096 },
        ],
    },
    {
        credential: 'GOOGLE_API_KEY',
        provider: 'google',
        models: [
            { id: 'google/gemini-2.5-pro', provider: 'google', label: 'Gemini 2.5 Pro', maxOutputTokens: 4096 },
            { id: 'google/gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash', maxOutputTokens: 4096 },
            { id: 'google/gemini-2.0-flash', provider: 'google', label: 'Gemini 2.0 Flash', maxOutputTokens: 4096 },
        ],
    },
    {
        credential: 'OPENROUTER_API_KEY',
        provider: 'openrouter',
        models: [
            { id: 'openrouter/auto', provider: 'openrouter', label: 'OpenRouter auto', maxOutputTokens: 4096 },
        ],
    },
    {
        credential: 'XAI_API_KEY',
        provider: 'xai',
        models: [
            { id: 'xai/grok-4', provider: 'xai', label: 'Grok 4', maxOutputTokens: 4096 },
            { id: 'xai/grok-3-mini', provider: 'xai', label: 'Grok 3 mini', maxOutputTokens: 4096 },
        ],
    },
    {
        credential: 'MISTRAL_API_KEY',
        provider: 'mistral',
        models: [
            { id: 'mistral/large-latest', provider: 'mistral', label: 'Mistral Large', maxOutputTokens: 4096 },
            { id: 'mistral/small-latest', provider: 'mistral', label: 'Mistral Small', maxOutputTokens: 4096 },
        ],
    },
    {
        credential: 'GROQ_API_KEY',
        provider: 'groq',
        models: [
            { id: 'groq/llama-3.3-70b-versatile', provider: 'groq', label: 'Llama 3.3 70B', maxOutputTokens: 4096 },
            { id: 'groq/llama-3.1-8b-instant', provider: 'groq', label: 'Llama 3.1 8B', maxOutputTokens: 4096 },
        ],
    },
    {
        credential: 'DEEPSEEK_API_KEY',
        provider: 'deepseek',
        models: [
            { id: 'deepseek/deepseek-chat', provider: 'deepseek', label: 'DeepSeek chat', maxOutputTokens: 4096 },
        ],
    },
];
/**
 * The Anna sampling lanes.
 *
 * Each lane is a soft preference handed to the host's selector. The host
 * resolves a concrete model, so a lane is named for the intent it asks for
 * rather than for a model that may not be chosen.
 */
const ANNA_LANES = [
    {
        id: 'anna/intelligence',
        provider: 'anna',
        label: 'Anna, quality lane',
        source: 'anna',
        hasKey: true,
        hint: 'intelligence',
        priorities: { intelligence: 1, speed: 0.2, cost: 0.2 },
    },
    {
        id: 'anna/speed',
        provider: 'anna',
        label: 'Anna, speed lane',
        source: 'anna',
        hasKey: true,
        hint: 'fast',
        priorities: { speed: 1, intelligence: 0.3, cost: 0.3 },
    },
    {
        id: 'anna/cost',
        provider: 'anna',
        label: 'Anna, cost lane',
        source: 'anna',
        hasKey: true,
        hint: 'cheap',
        priorities: { cost: 1, speed: 0.3, intelligence: 0.3 },
    },
];
/** The credential block declared in the Executa manifest. */
export const CREDENTIAL_SCHEMA = [
    { name: 'OPENAI_API_KEY', display_name: 'OpenAI API key', description: 'Runs OpenAI models on your own billing.', required: false, sensitive: true },
    { name: 'ANTHROPIC_API_KEY', display_name: 'Anthropic API key', description: 'Runs Claude models on your own billing.', required: false, sensitive: true },
    { name: 'GOOGLE_API_KEY', display_name: 'Google AI API key', description: 'Runs Gemini models on your own billing.', required: false, sensitive: true },
    { name: 'OPENROUTER_API_KEY', display_name: 'OpenRouter API key', description: 'Routes through the OpenRouter catalogue.', required: false, sensitive: true },
    { name: 'XAI_API_KEY', display_name: 'xAI API key', description: 'Runs Grok models on your own billing.', required: false, sensitive: true },
    { name: 'MISTRAL_API_KEY', display_name: 'Mistral API key', description: 'Runs Mistral models on your own billing.', required: false, sensitive: true },
    { name: 'GROQ_API_KEY', display_name: 'Groq API key', description: 'Runs Llama models on your own billing.', required: false, sensitive: true },
    { name: 'DEEPSEEK_API_KEY', display_name: 'DeepSeek API key', description: 'Runs DeepSeek models on your own billing.', required: false, sensitive: true },
];
/**
 * Whether a credential is present for this invoke.
 * @param credential The credential name as declared in the manifest.
 * @returns True when a non-empty value was injected.
 */
function hasCredential(credential) {
    const value = currentInvokeContext().credentials[credential];
    return typeof value === 'string' && value.trim().length > 0;
}
/**
 * Lists the models available for a trial, with a boolean key status.
 *
 * Never exposes credential material, only presence. Entries are sorted by
 * provider then model name so the bench chips do not reshuffle between loads.
 * @returns Roster entries available to the calling user right now.
 */
export async function listRoster() {
    const entries = [];
    for (const provider of PROVIDERS) {
        if (!hasCredential(provider.credential))
            continue;
        for (const model of provider.models) {
            entries.push({
                id: model.id,
                provider: model.provider,
                label: model.label,
                source: 'byok',
                hasKey: true,
            });
        }
    }
    // The Anna lanes are only real when the host granted sampling. Listing them
    // without it would promise a column the tool cannot actually run, so an
    // ungranted install sees an empty bench and the copy explains the fix.
    if (canSample()) {
        entries.push(...ANNA_LANES);
    }
    return entries.sort((a, b) => a.provider.localeCompare(b.provider) || a.label.localeCompare(b.label));
}
/**
 * Resolves one roster id to its catalogue row.
 * @param modelId The model identifier or Anna lane id.
 * @returns The catalogue row, or null for an Anna lane or an unknown id.
 */
export function catalogueFor(modelId) {
    for (const provider of PROVIDERS) {
        const found = provider.models.find((model) => model.id === modelId);
        if (found)
            return found;
    }
    return null;
}
/**
 * The credential name that unlocks a catalogue model.
 * @param modelId The model identifier.
 * @returns The credential name, or null for an Anna lane or an unknown id.
 */
export function credentialFor(modelId) {
    for (const provider of PROVIDERS) {
        if (provider.models.some((model) => model.id === modelId))
            return provider.credential;
    }
    return null;
}
/**
 * The Anna sampling lane matching a lane id.
 * @param modelId The lane identifier, for example `anna/speed`.
 * @returns The lane, or null when the id is not a lane.
 */
export function annaLaneFor(modelId) {
    return ANNA_LANES.find((lane) => lane.id === modelId) ?? null;
}
/**
 * The display label for a roster id.
 * @param modelId The model identifier or lane id.
 * @returns The catalogue label, or a trimmed id when unknown.
 */
export function labelFor(modelId) {
    return catalogueFor(modelId)?.label ?? annaLaneFor(modelId)?.label ?? modelId;
}
