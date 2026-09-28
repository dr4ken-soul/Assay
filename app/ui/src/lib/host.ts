/**
 * The host API layer.
 *
 * Every call the bundle makes to Anna goes through this module. No view ever
 * touches the raw SDK. Each wrapper is typed on both sides and turns a host
 * error into an `AssayHostError` carrying a cause and a fix, so an inline
 * message can always tell the user what to do next.
 *
 * The client is swappable. `installHostClient` exists so tests can drive the
 * views without a host, and it is the seam the blind DOM check runs through.
 */

import type {
  LockSlot,
  ModelId,
  PolicyView,
  RosterEntry,
  TaskType,
  TrialCrown,
  TrialDetail,
  TrialStarted,
  TrialStatus,
  TrialSummary,
  TrialUnblind,
  TrialVerdict,
} from './types'

/** The minted tool id, matching `manifest.ui.host_api.tools`. */
export const TOOL_ID = 'tool-dev-assay'

/** One method on the Executa. */
type ToolMethod =
  | 'roster_list'
  | 'trial_start'
  | 'trial_status'
  | 'trial_verdict'
  | 'trial_crown'
  | 'trial_unblind'
  | 'history_list'
  | 'history_get'
  | 'policy_get'
  | 'policy_set_lock'
  | 'policy_export'

/** Raised for every host or tool failure, always with a cause and a fix. */
export class AssayHostError extends Error {
  /** Stable code, so a view can branch without string matching. */
  readonly code: string
  /** What went wrong, in one line. */
  readonly cause: string
  /** What the user should do about it. */
  readonly fix: string
  /** When the next trial slot opens, set only for a rate limit. */
  readonly resetsAt?: string

  /**
   * Builds a host failure.
   * @param code Stable machine code, for example `rate_limited`.
   * @param cause One line describing what went wrong.
   * @param fix One line describing the next step.
   * @param resetsAt Optional reset time for a rate limit.
   */
  constructor(code: string, cause: string, fix: string, resetsAt?: string) {
    super(`${cause} ${fix}`.trim())
    this.name = 'AssayHostError'
    this.code = code
    this.cause = cause
    this.fix = fix
    this.resetsAt = resetsAt
  }
}

/** The subset of the Anna SDK this bundle uses. */
export interface HostClient {
  /** View metadata, used to pick the initial tab and set the window title. */
  viewMeta: { name: string; title: string }
  /** Invokes one Executa method and returns its unwrapped payload. */
  invoke<T>(method: ToolMethod, args: Record<string, unknown>, timeoutMs?: number): Promise<T>
  /** Sets the window chrome title. */
  setTitle(title: string): Promise<void>
}

/** The live client, or null before `connectHost` resolves. */
let client: HostClient | null = null

/**
 * Installs a client. Used by tests and by the standalone preview path.
 * @param next The client to install, or null to clear it.
 */
export function installHostClient(next: HostClient | null): void {
  client = next
}

/**
 * Whether the bundle is connected to a host.
 * @returns True when a client is installed.
 */
export function isConnected(): boolean {
  return client !== null
}

/** The minimal shape of the SDK object this bundle touches. */
interface SdkRuntime {
  viewMeta: { name: string; title: string }
  tools: { invoke(args: Record<string, unknown>): Promise<unknown> }
  window: { set_title(args: { title: string }): Promise<unknown> }
  on?: (event: string, handler: (payload: unknown) => void) => () => void
}

/**
 * Maps a tool method onto the user's next step.
 * @param method The method that failed.
 * @returns The fix line for that method.
 */
function fixFor(method: ToolMethod): string {
  switch (method) {
    case 'roster_list':
      return 'Add a provider key in Anna settings, or grant sampling so Anna credits can stand in.'
    case 'trial_start':
      return 'Pick at least two models on the bench, then run again.'
    case 'trial_status':
      return 'The trial record could not be read. Open the ledger to see what is there.'
    case 'trial_verdict':
      return 'The examiner needs Anna sampling. Enable it for Assay in the app permissions.'
    case 'trial_crown':
      return 'The crown was not recorded. Reopen the verdict and crown again.'
    case 'trial_unblind':
      return 'Crown a winner first, then the reveal will open.'
    case 'history_list':
    case 'history_get':
      return 'The ledger could not be read. Reopen the app window to retry.'
    case 'policy_get':
    case 'policy_set_lock':
    case 'policy_export':
      return 'The policy could not be read or written. Reopen the app window to retry.'
    default:
      return 'Reopen the app window to retry.'
  }
}

/**
 * Normalises whatever the host or the plugin returned into an AssayHostError.
 * @param method The method that failed.
 * @param error The thrown or returned failure.
 * @returns The normalised error.
 */
function toHostError(method: ToolMethod, error: unknown): AssayHostError {
  const code = (error as { code?: string })?.code ?? 'unknown'
  const message = (error as { message?: string })?.message ?? String(error)

  if (code === 'rate_limited') {
    const data = (error as { data?: { resetsAt?: string } })?.data
    return new AssayHostError('rate_limited', 'Six trials an hour, and all six are spent.', 'The bench reopens at the top of the hour.', data?.resetsAt)
  }
  if (code === 'permission_denied') {
    return new AssayHostError('permission_denied', 'Assay is not allowed to make that call.', 'Check the app permissions for tools and sampling.')
  }
  if (code === 'agent_unavailable') {
    return new AssayHostError('agent_unavailable', 'Your Anna agent is offline, so the tool could not be reached.', 'Open Anna on this device, then try again.')
  }
  if (code === 'tool_timeout' || code === 'tool_failed') {
    return new AssayHostError(code, 'The tool did not finish in time.', fixFor(method))
  }
  if (code === 'invalid_token') {
    return new AssayHostError('invalid_token', 'The window token expired.', 'Close and reopen the Assay window.')
  }
  return new AssayHostError(code, message, fixFor(method))
}

/**
 * Calls one Executa method and unwraps both response envelopes.
 * @param method The method name, matching a ToolDefinition.
 * @param args The method arguments.
 * @param timeoutMs Optional per call deadline, capped by the host at 90s.
 * @returns The unwrapped payload.
 * @throws AssayHostError when the host refuses, times out, or the tool fails.
 */
async function call<T>(method: ToolMethod, args: Record<string, unknown>, timeoutMs?: number): Promise<T> {
  if (!client) {
    throw new AssayHostError('not_connected', 'The window is not connected to Anna.', 'Reopen Assay from Anna.')
  }
  try {
    const raw = (await client.invoke<T>(method, args, timeoutMs)) as unknown
    // The host unwraps the transport envelope. The plugin envelope is ours:
    // on success `data` is the payload, on failure `data` carries the code.
    const envelope = raw as { success?: boolean; error?: string; data?: unknown }
    if (envelope && typeof envelope === 'object' && 'success' in envelope) {
      if (envelope.success === false) {
        const inner = (envelope.data ?? {}) as { code?: string; resetsAt?: string }
        throw toHostError(method, {
          code: inner.code ?? 'tool_failed',
          message: envelope.error ?? 'The tool did not complete.',
          data: { resetsAt: inner.resetsAt },
        })
      }
      return (envelope.data ?? (raw as T)) as T
    }
    return raw as T
  } catch (error) {
    if (error instanceof AssayHostError) throw error
    throw toHostError(method, error)
  }
}

/**
 * Connects the bundle to the Anna host.
 *
 * Loads the SDK from the host origin at runtime, never bundled, then installs
 * the client. Returns the view name so the shell can open the right tab.
 * @returns The view the host opened, for example `bench`.
 * @throws AssayHostError when the SDK is absent or the handshake fails.
 */
/**
 * The SDK paths to try, in order.
 *
 * The host serves the SDK from `/static`, and a pinned version is always
 * available alongside `latest`. The first path that both loads and connects
 * wins, so the bundle is not tied to one host build.
 */
const SDK_PATHS = [
  '/static/anna-apps/_sdk/latest/index.js',
  '/static/anna-apps/_sdk/0.1.0/index.js',
  '/anna-apps/_sdk/latest/index.js',
]

/**
 * Loads the SDK from the first path that resolves.
 * @returns The SDK module namespace.
 * @throws Error when no path yields a module exposing connect.
 */
async function loadSdk(): Promise<{ AnnaAppRuntime?: { connect(): Promise<SdkRuntime> }; default?: { connect(): Promise<SdkRuntime> } }> {
  let lastFailure: unknown = null
  for (const path of SDK_PATHS) {
    try {
      // Loaded at runtime from the host origin, never bundled and never rewritten.
      const module = (await import(/* @vite-ignore */ path)) as { AnnaAppRuntime?: { connect(): Promise<SdkRuntime> }; default?: { connect(): Promise<SdkRuntime> } }
      if (module.AnnaAppRuntime?.connect ?? module.default?.connect) return module
    } catch (error) {
      lastFailure = error
    }
  }
  throw lastFailure instanceof Error ? lastFailure : new Error('no SDK path resolved')
}

/**
 * Connects the bundle to the Anna host.
 *
 * Loads the SDK from the host origin at runtime, never bundled, then installs
 * the client. Returns the view name so the shell can open the right tab.
 * @returns The view the host opened, for example `bench`.
 * @throws AssayHostError when the SDK is absent or the handshake fails.
 */
export async function connectHost(): Promise<string> {
  let sdk: Awaited<ReturnType<typeof loadSdk>>
  try {
    sdk = await loadSdk()
  } catch {
    throw new AssayHostError(
      'sdk_missing',
      'The Anna app SDK did not load.',
      'Open Assay from inside Anna rather than a bare browser tab.',
    )
  }
  const connect = sdk.AnnaAppRuntime?.connect ?? sdk.default?.connect
  if (!connect) {
    throw new AssayHostError('sdk_missing', 'The Anna app SDK did not load.', 'Open Assay from inside Anna rather than a bare browser tab.')
  }

  let runtime: SdkRuntime
  try {
    runtime = await connect()
  } catch (error) {
    throw new AssayHostError('not_connected', (error as Error)?.message ?? 'The handshake failed.', 'Close and reopen the Assay window from Anna.')
  }

  installHostClient({
    viewMeta: runtime.viewMeta,
    invoke: async <T,>(method: ToolMethod, args: Record<string, unknown>, timeoutMs?: number) =>
      runtime.tools.invoke({ tool_id: TOOL_ID, method, args, timeoutMs }) as Promise<T>,
    setTitle: async (title: string) => {
      await runtime.window.set_title({ title })
    },
  })

  return runtime.viewMeta?.name ?? 'bench'
}

/**
 * Sets the window chrome title.
 * @param title The title to show in the window chrome.
 * @returns Nothing. A refusal is swallowed, the title is decoration.
 */
export async function setWindowTitle(title: string): Promise<void> {
  if (!client) return
  try {
    await client.setTitle(title)
  } catch {
    /* decoration only, never surface a title failure */
  }
}

/**
 * Lists the models on the bench.
 * @returns Roster entries, sorted by provider then label.
 * @throws AssayHostError when the roster cannot be read.
 */
export function listRoster(): Promise<{ roster: RosterEntry[] }> {
  return call('roster_list', {}, 20000)
}

/**
 * Starts a blind trial. Returns as soon as the mapping is sealed.
 * @param workload The task text, the real workload.
 * @param rosterIds At least two roster identifiers.
 * @returns The trial id and the letters in run order.
 * @throws AssayHostError when the limit is hit or the roster is too small.
 */
export function startTrial(workload: string, rosterIds: ModelId[]): Promise<TrialStarted> {
  return call('trial_start', { workload, roster_ids: rosterIds }, 30000)
}

/**
 * Reads live column state for a trial.
 * @param trialId The trial identifier.
 * @returns Per-letter state and timers, never the mapping.
 * @throws AssayHostError when the trial cannot be read.
 */
export function trialStatus(trialId: string): Promise<TrialStatus> {
  return call('trial_status', { trial_id: trialId }, 20000)
}

/**
 * Scores the anonymised outputs and returns the verdict.
 * @param trialId The trial identifier.
 * @returns The verdict report.
 * @throws AssayHostError when the examiner fails.
 */
export function trialVerdict(trialId: string): Promise<TrialVerdict> {
  return call('trial_verdict', { trial_id: trialId }, 90000)
}

/**
 * Records the user's blind choice.
 * @param trialId The trial identifier.
 * @param letter The winning column, or the word `tie`.
 * @returns The confirmation and the policy preview.
 * @throws AssayHostError when the trial is already crowned.
 */
export function crownTrial(trialId: string, letter: string): Promise<TrialCrown> {
  return call('trial_crown', { trial_id: trialId, letter }, 30000)
}

/**
 * Lifts the blind and returns the mapping.
 * @param trialId The trial identifier.
 * @returns The letter to model mapping.
 * @throws AssayHostError when there is no crown yet.
 */
export function unblindTrial(trialId: string): Promise<TrialUnblind> {
  return call('trial_unblind', { trial_id: trialId }, 20000)
}

/**
 * Lists the ledger.
 * @param limit How many rows to fetch.
 * @returns Trial summaries, newest first.
 * @throws AssayHostError when the ledger cannot be read.
 */
export function listHistory(limit = 50): Promise<{ trials: TrialSummary[]; total: number }> {
  return call('history_list', { limit }, 30000)
}

/**
 * Reads one full ledger record.
 * @param trialId The trial identifier.
 * @returns The record, names only once unblinded.
 * @throws AssayHostError when the record cannot be read.
 */
export function getHistory(trialId: string): Promise<{ trial: TrialDetail }> {
  return call('history_get', { trial_id: trialId }, 20000)
}

/**
 * Reads the routing policy.
 * @returns Weights, rank, locks and version.
 * @throws AssayHostError when the policy cannot be read.
 */
export function getPolicy(): Promise<PolicyView> {
  return call('policy_get', {}, 20000)
}

/**
 * Sets or clears one routing lock.
 * @param task The task lane.
 * @param slot The locked slot.
 * @param modelId The model to lock, or null to unlock.
 * @returns The updated policy view.
 * @throws AssayHostError when the lock cannot be written.
 */
export function setPolicyLock(task: TaskType, slot: LockSlot, modelId: ModelId | null): Promise<PolicyView> {
  return call('policy_set_lock', { task, slot, model_id: modelId }, 20000)
}

/**
 * Exports the policy as a JSON string.
 * @returns The JSON and the policy version it was taken at.
 * @throws AssayHostError when the export fails.
 */
export function exportPolicy(): Promise<{ json: string; version: number }> {
  return call('policy_export', {}, 20000)
}

/**
 * Copies text to the clipboard, with a fallback for a refused permission.
 * @param text The text to copy.
 * @returns True when the clipboard took it.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the manual path below */
  }
  return false
}
