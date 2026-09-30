/**
 * Blind trial execution, anonymisation and timing.
 *
 * The order of operations is fixed and is the product's core promise:
 *
 *   1. shuffle the roster with a cryptographic shuffle
 *   2. assign letters in run order, so letter order is uncorrelated with roster order
 *   3. write the letter to model mapping to APS before the first call
 *   4. run every column in parallel with Promise.allSettled
 *   5. mark a failure FAILED, capture the error class only, never substitute or retry
 *
 * Nothing in this module logs a model name, a provider name, a workload or an
 * output. Logs carry the trial id and the letter, never anything that could
 * lift the blind.
 */

import { randomInt } from 'node:crypto'
import { canSample, currentInvokeContext, logLine, reverseCall, ReverseRpcError, RPC_ERROR } from './rpc.js'
import { computeCostUsd, computeRunningCostUsd, estimateTokens } from './cost.js'
import { annaLaneFor, catalogueFor, credentialFor } from './roster.js'
import { loadTrial, saveTrial, writeKey } from './store.js'
import type {
  ColumnResult,
  ColumnStatus,
  Letter,
  ModelId,
  RosterEntry,
  TrialErrorClass,
  TrialRecord,
  TrialSource,
} from './types.js'
import { TRIAL_RATE_LIMIT, TRIAL_RATE_WINDOW_MS, RATE_LIMIT_PREFIX } from './types.js'

/** Wall clock ceiling for one column. Past this the column is a timeout. */
const COLUMN_TIMEOUT_MS = 75_000

/** How many letters the bench can hold. A, B, C, up to Z. */
const MAX_COLUMNS = 12

/** The alphabetic suffix sequence, A through Z. */
const LETTER_SUFFIXES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Live column progress, keyed by trial id then letter. Survives within the process. */
const liveProgress = new Map<string, Map<Letter, ColumnStatus>>()

/** Raised when the user is over the trial rate limit. */
export class RateLimitError extends Error {
  /** When the next trial becomes available, as an ISO timestamp. */
  readonly resetsAt: string
  /** Trials allowed inside one window. */
  readonly limit: number

  /**
   * Builds the rate limit failure the UI renders.
   * @param limit Trials allowed per window.
   * @param resetsAt ISO timestamp of the next free slot.
   */
  constructor(limit: number, resetsAt: string) {
    super(`Rate limit reached. ${limit} trials per hour, next slot ${resetsAt}.`)
    this.name = 'RateLimitError'
    this.limit = limit
    this.resetsAt = resetsAt
  }
}

/** The window bucket key for the current hour. */
function rateLimitBucket(now: number): string {
  const bucket = Math.floor(now / TRIAL_RATE_WINDOW_MS)
  return `${RATE_LIMIT_PREFIX}${bucket}`
}

/**
 * Consumes one trial slot, or throws when the user is over the limit.
 *
 * The window is held in APS, so the limit holds across a plugin restart.
 * @param now Injectable clock, for tests.
 * @returns The number of trials already spent inside this window.
 * @throws RateLimitError when the window is full.
 */
export async function consumeRateLimitSlot(now = Date.now()): Promise<number> {
  const key = rateLimitBucket(now)
  const stamps = ((await readStamps(key)) as number[] | null) ?? []
  const floor = now - TRIAL_RATE_WINDOW_MS
  const live = stamps.filter((stamp) => stamp > floor)

  if (live.length >= TRIAL_RATE_LIMIT) {
    const oldest = Math.min(...live)
    throw new RateLimitError(TRIAL_RATE_LIMIT, new Date(oldest + TRIAL_RATE_WINDOW_MS).toISOString())
  }

  live.push(now)
  await writeKey(key, live)
  return live.length
}

/**
 * Reads the trial timestamps in one window bucket.
 * @param key The bucket key.
 * @returns The stored timestamps, or null.
 */
async function readStamps(key: string): Promise<unknown> {
  const { readKey } = await import('./store.js')
  return readKey<number[]>(key)
}

/**
 * Cryptographic Fisher-Yates shuffle.
 * @param items The array to shuffle. A new array is returned.
 * @returns A shuffled copy.
 */
export function seededShuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1)
    const held = copy[index]
    copy[index] = copy[swap]
    copy[swap] = held
  }
  return copy
}

/**
 * The anonymised column key for a run position.
 * @param index Zero based run position.
 * @returns The letter, for example `MODEL A`.
 */
export function letterForIndex(index: number): Letter {
  return `MODEL ${LETTER_SUFFIXES[index] ?? index + 1}`
}

/**
 * Mints a trial identifier.
 * @returns A short unique identifier.
 */
function newTrialId(): string {
  const stamp = Date.now().toString(36)
  const noise = randomInt(0x100000, 0xffffff).toString(36)
  return `t_${stamp}_${noise}`
}

/**
 * Starts a blind trial: shuffle, assign letters, persist the mapping, then run.
 *
 * Returns as soon as the mapping is durable. The columns run in the background
 * and the UI polls `trial_status` for progress, so the call stays well inside
 * the synchronous invoke ceiling no matter how slow the models are.
 * @param workload The task text, the real workload the user pasted.
 * @param rosterIds The roster identifiers selected on the bench, at least two.
 * @param sources Optional source hint per roster id. Derived from the catalogue when absent.
 * @returns The trial id and the letters in run order.
 * @throws RateLimitError when the hourly window is full.
 * @throws Error when fewer than two or more than twelve models were selected.
 */
export async function startTrial(
  workload: string,
  rosterIds: ModelId[],
  sources?: Record<string, TrialSource>,
): Promise<{ trialId: string; letters: Letter[]; startedAt: string }> {
  const text = (workload ?? '').trim()
  if (text.length < 8) throw new Error('Workload needs at least 8 characters to be worth a trial.')
  const unique = [...new Set(rosterIds.filter((id) => typeof id === 'string' && id.length > 0))]
  if (unique.length < 2) throw new Error('A blind trial needs at least two models. The blind needs company.')
  if (unique.length > MAX_COLUMNS) throw new Error(`A trial holds at most ${MAX_COLUMNS} columns.`)

  const spent = await consumeRateLimitSlot()
  logLine('trial slot consumed', `count=${spent}`)

  const shuffled = seededShuffle(unique)
  const letters = shuffled.map((_, index) => letterForIndex(index))

  const record: TrialRecord = {
    id: newTrialId(),
    createdAt: new Date().toISOString(),
    workload: text,
    rosterLetters: {},
    rosterLabels: {},
    rosterSources: {},
    results: {},
    verdict: null,
    crown: null,
    unblindedAt: null,
    crowned: false,
    runMs: 0,
  }

  for (const [index, modelId] of shuffled.entries()) {
    const letter = letters[index]
    record.rosterLetters[letter] = modelId
    record.rosterLabels[letter] = labelFor(modelId)
    record.rosterSources[letter] = sources?.[modelId] ?? (annaLaneFor(modelId) ? 'anna' : 'byok')
  }

  // The mapping is durable before the first call, so a crash mid-run can
  // never leak a name through ordering or through a partially written record.
  await saveTrial(record)
  liveProgress.set(record.id, new Map(letters.map((letter) => [letter, pendingStatus(letter)])))

  const startedAt = new Date().toISOString()
  void runTrial(record, letters, startedAt)

  return { trialId: record.id, letters, startedAt }
}

/** A column that has not started yet. */
function pendingStatus(letter: Letter): ColumnStatus {
  return { letter, state: 'pending', latencyMs: 0, costUsd: null, tokensOut: 0 }
}

/**
 * The display label for a roster id, resolved without exposing credentials.
 * @param modelId The roster identifier.
 * @returns The catalogue label.
 */
function labelFor(modelId: ModelId): string {
  return catalogueFor(modelId)?.label ?? annaLaneFor(modelId)?.label ?? modelId
}

/**
 * Runs every column in parallel, then seals the run.
 * @param record The trial record, already holding the mapping.
 * @param letters The letters in run order.
 * @param startedAtIso When the run began, for the run wall clock.
 */
async function runTrial(record: TrialRecord, letters: Letter[], startedAtIso: string): Promise<void> {
  const started = Date.parse(startedAtIso)
  const progress = liveProgress.get(record.id) ?? new Map<Letter, ColumnStatus>()

  const settled = await Promise.allSettled(
    letters.map(async (letter) => {
      progress.set(letter, { ...pendingStatus(letter), state: 'running' })
      return runColumn(record, letter)
    }),
  )

  for (const [index, outcome] of settled.entries()) {
    const letter = letters[index]
    if (outcome.status === 'fulfilled') {
      record.results[letter] = outcome.value
      progress.set(letter, {
        letter,
        state: outcome.value.state,
        latencyMs: outcome.value.latencyMs,
        costUsd: outcome.value.costUsd,
        tokensOut: outcome.value.tokensOut,
        errorClass: outcome.value.errorClass,
        errorHint: outcome.value.errorHint,
      })
    } else {
      const failure = outcome.reason as Error
      record.results[letter] = {
        state: 'failed',
        latencyMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        tokensEstimated: false,
        costUsd: null,
        costSource: 'unavailable',
        output: '',
        errorClass: 'unknown',
        errorHint: 'this column did not return, run it again to see the cause',
      }
      progress.set(letter, {
        letter,
        state: 'failed',
        latencyMs: 0,
        costUsd: null,
        tokensOut: 0,
        errorClass: 'unknown',
        errorHint: 'this column did not return, run it again to see the cause',
      })
      logLine('column rejected', letter, failure.name)
    }
  }

  record.runMs = Math.max(0, Date.now() - started)
  await saveTrial(record)
  logLine('trial settled', `columns=${letters.length}`)
}

/**
 * Executes one column and measures it.
 *
 * A failure is a FAILED column carrying an error class and an operator hint.
 * There is no retry and no substitution.
 * @param record The trial record, read only here.
 * @param letter The anonymised column key.
 * @returns The measured result, ok or failed.
 */
async function runColumn(record: TrialRecord, letter: Letter): Promise<ColumnResult> {
  const modelId = record.rosterLetters[letter]
  const source = record.rosterSources[letter]
  const started = Date.now()

  try {
    const raw =
      source === 'anna'
        ? await callAnnaLane(modelId, record.workload)
        : await callProvider(modelId, record.workload)

    const output = raw.text.trim()
    if (!output) {
      return failedColumn(letter, started, 'empty', 'the provider returned an empty answer, check the model still serves this task')
    }

    const tokensIn = raw.tokensIn ?? estimateTokens(record.workload)
    const tokensOut = raw.tokensOut ?? estimateTokens(output)
    const tokensEstimated = raw.tokensIn === undefined || raw.tokensOut === undefined
    const costUsd = source === 'anna' ? null : computeCostUsd(modelId, tokensIn, tokensOut)

    const progress = liveProgress.get(record.id)
    if (progress) {
      const live = progress.get(letter)
      if (live) progress.set(letter, { ...live, costUsd: source === 'anna' ? null : computeRunningCostUsd(modelId, tokensIn) })
    }

    return {
      state: 'ok',
      latencyMs: Date.now() - started,
      tokensIn,
      tokensOut,
      tokensEstimated,
      costUsd,
      costSource: source === 'anna' ? 'unavailable' : 'price-table',
      output,
    }
  } catch (error) {
    const classified = classify(error, source)
    logLine('column failed', letter, classified.errorClass)
    return failedColumn(letter, started, classified.errorClass, classified.hint)
  }
}

/**
 * Builds a FAILED column.
 * @param letter The anonymised column key.
 * @param startedMs The start timestamp used for latency.
 * @param errorClass The coarse failure classification.
 * @param hint The operator-facing next step, never provider text.
 * @returns The FAILED column result.
 */
function failedColumn(letter: Letter, startedMs: number, errorClass: TrialErrorClass, hint: string): ColumnResult {
  void letter
  return {
    state: 'failed',
    latencyMs: Math.max(0, Date.now() - startedMs),
    tokensIn: 0,
    tokensOut: 0,
    tokensEstimated: false,
    costUsd: null,
    costSource: 'unavailable',
    output: '',
    errorClass,
    errorHint: hint,
  }
}

/** The error shape every provider path rejects with. */
class ProviderError extends Error {
  /** The coarse classification derived from the upstream failure. */
  readonly errorClass: TrialErrorClass
  /** Operator-facing next step. */
  readonly hint: string

  /**
   * Builds a provider failure carrying only a class and a hint.
   * @param errorClass Coarse classification.
   * @param hint Operator-facing next step.
   * @param message Short internal message, never surfaced and never logged with body text.
   */
  constructor(errorClass: TrialErrorClass, hint: string, message: string) {
    super(message)
    this.name = 'ProviderError'
    this.errorClass = errorClass
    this.hint = hint
  }
}

/**
 * Classifies a failure without ever surfacing provider text.
 *
 * A reverse RPC failure is separated from a provider failure because the fix
 * is different. A host that refuses `sampling/createMessage` never reached a
 * model at all, so telling the operator to check their API key sends them
 * looking in the wrong place when no key was involved.
 *
 * @param error The thrown value.
 * @param source Whether the column was an Anna lane or a bring-your-own-key model.
 * @returns The classification and the operator hint.
 */
function classify(error: unknown, source: 'anna' | 'byok'): { errorClass: TrialErrorClass; hint: string } {
  if (error instanceof ProviderError) return { errorClass: error.errorClass, hint: error.hint }

  if (error instanceof ReverseRpcError) {
    if (error.code === RPC_ERROR.samplingNotGranted) {
      return { errorClass: 'auth', hint: 'Anna has sampling switched off for this app, turn it on in the app permissions' }
    }
    if (error.code === RPC_ERROR.samplingNotNegotiated) {
      return { errorClass: 'auth', hint: 'this host did not grant Anna sampling, the app cannot call a model from here' }
    }
    if (error.code === RPC_ERROR.methodNotFound) {
      return {
        errorClass: 'auth',
        hint: 'this host does not implement Anna sampling, run the trial in Anna rather than a local harness',
      }
    }
    return { errorClass: 'status', hint: 'Anna refused the sampling call for this lane, check the app permissions' }
  }

  const name = (error as Error)?.name ?? ''
  if (name === 'AbortError' || name === 'TimeoutError') {
    return { errorClass: 'timeout', hint: 'the provider did not answer inside 75s, try a faster column' }
  }

  if (source === 'anna') {
    return { errorClass: 'unknown', hint: 'the Anna lane did not return an answer, this host cannot run the lane' }
  }
  return { errorClass: 'unknown', hint: 'the call did not complete, check the key for this provider' }
}

/**
 * Exposes the column failure classifier to the test suite.
 *
 * The classifier is internal to a column run, and the hint it picks is the
 * only diagnostic a failed column surfaces, so it is worth pinning.
 *
 * @param error The thrown value.
 * @param source Whether the column was an Anna lane or a bring-your-own-key model.
 * @returns The classification and the operator hint.
 */
export function classifyForTest(
  error: unknown,
  source: 'anna' | 'byok',
): { errorClass: TrialErrorClass; hint: string } {
  return classify(error, source)
}

/** The shape every provider adapter returns. */
interface ProviderReply {
  text: string
  tokensIn?: number
  tokensOut?: number
  /** The concrete model the provider actually served, for the post-unblind ledger. */
  servedModel?: string
}

/**
 * Calls a BYOK provider over its own HTTP API using the injected credential.
 *
 * The credential is read from the request scoped context, used in a header,
 * and dropped. It is never logged, returned or stored.
 * @param modelId The catalogue model id.
 * @param workload The task text.
 * @returns The reply text and any token counts the provider reported.
 */
async function callProvider(modelId: ModelId, workload: string): Promise<ProviderReply> {
  const credentialName = credentialFor(modelId)
  const model = catalogueFor(modelId)
  if (!credentialName || !model) {
    throw new ProviderError('auth', 'this model is not on the bench, refresh the roster', 'unknown catalogue model')
  }

  const apiKey = currentInvokeContext().credentials[credentialName]
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ProviderError('auth', 'the key for this provider is missing, add it in Anna settings', 'credential absent')
  }

  const bare = modelId.includes('/') ? modelId.slice(modelId.indexOf('/') + 1) : modelId
  const endpoint = providerEndpoint(model.provider, bare)
  const body = providerBody(model.provider, bare, workload, model.maxOutputTokens)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), COLUMN_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...endpoint.headers(apiKey) },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    throw error
  }
  clearTimeout(timer)

  if (!response.ok) {
    throw providerStatusError(response.status)
  }

  const payload = (await response.json()) as Record<string, unknown>
  const parsed = providerReply(model.provider, payload, bare)
  if (!parsed.text) {
    throw new ProviderError('empty', 'the provider returned an empty answer, check the model still serves this task', 'empty text')
  }
  return parsed
}

/**
 * Builds the endpoint and headers for one provider.
 * @param provider The provider handle.
 * @param bare The model id without its provider prefix.
 * @returns The absolute URL and a header factory taking the credential.
 */
function providerEndpoint(
  provider: string,
  bare: string,
): { url: string; headers: (apiKey: string) => Record<string, string> } {
  const bearer = (apiKey: string) => ({ authorization: `Bearer ${apiKey}` })
  switch (provider) {
    case 'openai':
      return { url: 'https://api.openai.com/v1/chat/completions', headers: bearer }
    case 'openrouter':
      return { url: 'https://openrouter.ai/api/v1/chat/completions', headers: bearer }
    case 'xai':
      return { url: 'https://api.x.ai/v1/chat/completions', headers: bearer }
    case 'mistral':
      return { url: 'https://api.mistral.ai/v1/chat/completions', headers: bearer }
    case 'groq':
      return { url: 'https://api.groq.com/openai/v1/chat/completions', headers: bearer }
    case 'deepseek':
      return { url: 'https://api.deepseek.com/chat/completions', headers: bearer }
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: (apiKey) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
      }
    case 'google':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${bare}:generateContent`,
        headers: (apiKey) => ({ 'x-goog-api-key': apiKey }),
      }
    default:
      throw new ProviderError('provider', 'this provider is not wired yet', `unmapped provider ${provider}`)
  }
}

/**
 * Builds the request body for one provider.
 * @param provider The provider handle.
 * @param bare The model id without its provider prefix.
 * @param workload The task text.
 * @param maxOutputTokens The output ceiling for this catalogue row.
 * @returns The JSON body.
 */
function providerBody(provider: string, bare: string, workload: string, maxOutputTokens: number): unknown {
  switch (provider) {
    case 'anthropic':
      return { model: bare, max_tokens: maxOutputTokens, temperature: 0.2, messages: [{ role: 'user', content: workload }] }
    case 'google':
      return {
        contents: [{ role: 'user', parts: [{ text: workload }] }],
        generationConfig: { maxOutputTokens, temperature: 0.2 },
      }
    default:
      return {
        model: bare,
        max_tokens: maxOutputTokens,
        temperature: 0.2,
        messages: [{ role: 'user', content: workload }],
      }
  }
}

/**
 * Extracts text and token counts from a provider response.
 * @param provider The provider handle.
 * @param payload The parsed JSON body.
 * @param bare The model id without its provider prefix, used for the openrouter auto alias.
 * @returns The reply shape.
 */
function providerReply(provider: string, payload: Record<string, unknown>, bare: string): ProviderReply {
  const servedModel = typeof payload.model === 'string' ? payload.model : undefined

  if (provider === 'anthropic') {
    const blocks = Array.isArray(payload.content) ? payload.content : []
    const text = blocks
      .map((block) => (typeof block === 'object' && block ? (block as Record<string, unknown>).text : null))
      .filter((value): value is string => typeof value === 'string')
      .join('')
    const usage = (payload.usage ?? {}) as Record<string, unknown>
    return {
      text,
      tokensIn: typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined,
      tokensOut: typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined,
      servedModel,
    }
  }

  if (provider === 'google') {
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
    const parts = candidates
      .flatMap((candidate) => {
        const content = (candidate as Record<string, unknown>)?.content as Record<string, unknown> | undefined
        const list = Array.isArray(content?.parts) ? (content?.parts as unknown[]) : []
        return list
      })
      .map((part) => (typeof part === 'object' && part ? (part as Record<string, unknown>).text : null))
      .filter((value): value is string => typeof value === 'string')
    const usage = (payload.usageMetadata ?? {}) as Record<string, unknown>
    return {
      text: parts.join(''),
      tokensIn: typeof usage.promptTokenCount === 'number' ? usage.promptTokenCount : undefined,
      tokensOut: typeof usage.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : undefined,
      servedModel,
    }
  }

  // Every remaining provider speaks the OpenAI chat completions shape.
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const message = (choices[0] as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined
  const text = typeof message?.content === 'string' ? message.content : ''
  const usage = (payload.usage ?? {}) as Record<string, unknown>
  return {
    text,
    tokensIn: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : undefined,
    tokensOut: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : undefined,
    servedModel: provider === 'openrouter' && servedModel === 'openrouter/auto' ? `${bare} via openrouter` : servedModel,
  }
}

/**
 * Turns an HTTP status into a classification and a hint.
 * @param status The upstream status code.
 * @returns The provider error to throw.
 */
function providerStatusError(status: number): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('auth', 'the key for this provider was rejected, check it in Anna settings', 'auth status')
  }
  if (status === 408 || status === 504) {
    return new ProviderError('timeout', 'the provider ran out of time, try a faster column', 'timeout status')
  }
  if (status === 429) {
    return new ProviderError('status', 'the provider is rate limiting this key, try again shortly', 'rate limited')
  }
  if (status >= 500) {
    return new ProviderError('provider', 'the provider is unhealthy right now, run it again later', 'upstream error')
  }
  return new ProviderError('status', 'the provider rejected this request, check the task text', 'bad request')
}

/**
 * Calls one Anna sampling lane through the host's reverse RPC.
 *
 * The host resolves the concrete model behind the lane hint. That resolved
 * name lands in the trial record and is only ever shown after the unblind.
 * @param modelId The lane id, for example `anna/speed`.
 * @param workload The task text.
 * @returns The reply text and any token counts the host reported.
 */
async function callAnnaLane(modelId: ModelId, workload: string): Promise<ProviderReply> {
  if (!canSample()) {
    throw new ProviderError('auth', 'Anna sampling is off for this app, enable it in permissions', 'sampling not negotiated')
  }
  const lane = annaLaneFor(modelId)
  if (!lane) throw new ProviderError('provider', 'this lane is not on the bench', 'unknown lane')

  const preferences: Record<string, unknown> = {
    hints: [{ name: lane.hint ?? 'general' }],
  }
  if (lane.priorities?.cost) preferences.costPriority = lane.priorities.cost
  if (lane.priorities?.speed) preferences.speedPriority = lane.priorities.speed
  if (lane.priorities?.intelligence) preferences.intelligencePriority = lane.priorities.intelligence

  const result = (await reverseCall('sampling/createMessage', {
    messages: [{ role: 'user', content: { type: 'text', text: workload } }],
    max_tokens: 4096,
    temperature: 0.2,
    model_preferences: preferences,
    include_context: 'none',
  })) as Record<string, unknown>

  return samplingReply(result)
}

/**
 * Extracts text, tokens and the served model from a sampling response.
 *
 * The host shape has moved across versions, so the extractor is deliberately
 * tolerant and never guesses a token count it did not receive.
 * @param result The reverse call result.
 * @returns The reply shape.
 */
function samplingReply(result: Record<string, unknown>): ProviderReply {
  const content = result.content as Record<string, unknown> | undefined
  const nested = content?.content as Record<string, unknown> | undefined
  const textCandidates = [content?.text, nested?.text, result.text, result.output_text]
  const text = textCandidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? ''

  const usage = (result.usage ?? content?.usage ?? {}) as Record<string, unknown>
  const tokensIn = [usage.input_tokens, usage.inputTokens, usage.prompt_tokens].find(
    (value): value is number => typeof value === 'number',
  )
  const tokensOut = [usage.output_tokens, usage.outputTokens, usage.completion_tokens].find(
    (value): value is number => typeof value === 'number',
  )
  const meta = (result._meta ?? {}) as Record<string, unknown>
  const servedModel = typeof result.model === 'string' ? result.model : typeof meta.provider === 'string' ? meta.provider : undefined

  if (!text) {
    throw new ReverseRpcError(-32003, 'sampling returned no text')
  }

  return { text, tokensIn, tokensOut, servedModel }
}

/**
 * Reads the live column states for a trial.
 * @param trialId The trial identifier.
 * @returns Per-letter state and live timers, never the mapping.
 */
export async function trialStatus(trialId: string): Promise<{
  trialId: string
  state: 'running' | 'settled'
  letters: Letter[]
  columns: ColumnStatus[]
  runMs: number
  stored: boolean
}> {
  const record = await loadTrial(trialId)
  if (!record) throw new Error('Trial not found. It may have been cleared from storage.')

  const letters = Object.keys(record.rosterLetters)
  const live = liveProgress.get(trialId)
  const columns: ColumnStatus[] = letters.map((letter) => {
    const settled = record.results[letter]
    if (settled) {
      return {
        letter,
        state: settled.state,
        latencyMs: settled.latencyMs,
        costUsd: settled.costUsd,
        tokensOut: settled.tokensOut,
        errorClass: settled.errorClass,
        errorHint: settled.errorHint,
      }
    }
    return live?.get(letter) ?? pendingStatus(letter)
  })

  const settled = letters.every((letter) => record.results[letter] !== undefined)
  return {
    trialId,
    state: settled ? 'settled' : 'running',
    letters,
    columns,
    runMs: record.runMs,
    stored: true,
  }
}

/**
 * Reads a roster entry list, used to resolve the user's selection to sources.
 * @param ids The roster identifiers.
 * @returns The matching entries, in the same order.
 */
export async function resolveRoster(ids: ModelId[]): Promise<RosterEntry[]> {
  const { listRoster } = await import('./roster.js')
  const roster = await listRoster()
  return ids
    .map((id) => roster.find((entry) => entry.id === id))
    .filter((entry): entry is RosterEntry => entry !== undefined)
}
