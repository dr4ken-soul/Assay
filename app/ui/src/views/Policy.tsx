/**
 * The routing policy screen.
 *
 * The ranking the crowns produced, the locks per task lane, and the export.
 * A lock always beats the computed rank, because a user who has said where a
 * lane goes has said something the data cannot improve on.
 */

import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { CheckIcon } from '../components/Icon'
import { EmptyState, ErrorNote, PrimaryButton } from '../components/Primitives'
import { formatShare } from '../lib/format'
import { EASE, useReducedMotion } from '../lib/motion'
import { AssayHostError, copyToClipboard, exportPolicy, getPolicy, setPolicyLock } from '../lib/host'
import { LOCK_SLOTS, TASK_TYPES } from '../lib/types'
import type { LockSlot, ModelId, PolicyView, TaskType } from '../lib/types'

/** The display label for a lock slot. */
const SLOT_LABEL: Record<LockSlot, string> = {
  default: 'Default',
  fallback: 'Fallback',
  budget: 'Budget',
}

/** The display label for a task lane. */
const TASK_LABEL: Record<TaskType, string> = {
  draft: 'Draft',
  rewrite: 'Rewrite',
  extract: 'Extract',
  code: 'Code',
  analyse: 'Analyse',
}

/**
 * Converts a host error into the two lines an inline error shows.
 * @param error The thrown value.
 * @returns The cause and the fix.
 */
function readError(error: unknown): { cause: string; fix: string } {
  if (error instanceof AssayHostError) return { cause: error.cause, fix: error.fix }
  return { cause: 'The policy could not be read.', fix: 'Reopen the Assay window to retry.' }
}

/**
 * The policy screen.
 * @returns The policy element.
 */
export function Policy() {
  const reduced = useReducedMotion()
  const [policy, setPolicy] = useState<PolicyView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: string; fix: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  /**
   * Loads the policy.
   * @returns Nothing.
   */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPolicy(await getPolicy())
      setError(null)
    } catch (caught) {
      setError(readError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  /**
   * Writes one lock and refreshes the view from the tool's own response.
   * @param task The task lane.
   * @param slot The locked slot.
   * @param modelId The model to lock, or null to unlock.
   * @returns Nothing.
   */
  const setLock = async (task: TaskType, slot: LockSlot, modelId: ModelId | null) => {
    try {
      setPolicy(await setPolicyLock(task, slot, modelId))
      setError(null)
    } catch (caught) {
      setError(readError(caught))
    }
  }

  /**
   * Exports the policy as JSON and copies it.
   * @returns Nothing.
   */
  const runExport = async () => {
    try {
      const { json } = await exportPolicy()
      const taken = await copyToClipboard(json)
      setCopied(true)
      setToast(taken ? 'POLICY COPIED' : 'EXPORT READY, COPY IT FROM THE DIALOG')
      window.setTimeout(() => setCopied(false), 1800)
    } catch (caught) {
      setError(readError(caught))
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6" data-testid="policy-loading">
        <div className="h-8 w-64 rounded bg-bench-secondary shimmer" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-10 w-full rounded bg-bench-secondary shimmer" />
          ))}
        </div>
      </div>
    )
  }

  if (!policy) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <ErrorNote cause={error?.cause ?? 'The policy is unavailable.'} fix={error?.fix ?? 'Reopen the Assay window.'} onRetry={load} />
      </div>
    )
  }

  if (policy.rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <h2 className="mb-6 font-display text-2xl font-black uppercase tracking-[-0.02em] text-ink-primary">ROUTING POLICY</h2>
        <EmptyState
          title="No crowns yet"
          body="Every crown you make shifts the weights. Run a trial on the bench and crown a winner to seed the policy."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6" data-testid="policy">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-black uppercase tracking-[-0.02em] text-ink-primary">ROUTING POLICY</h2>
        <p className="font-mono text-xs text-ink-muted">
          V{policy.version} / {policy.crownsRecorded} CROWNS
        </p>
      </div>

      <div className="divide-y divide-line-subtle border-y border-line-subtle" data-testid="rank-list">
        {policy.rows.map((row) => (
          <div key={row.modelId} className="grid grid-cols-12 items-center gap-4 py-4 max-md:grid-cols-6">
            <span className="col-span-1 font-mono text-xs text-ink-muted max-md:col-span-1">{row.rank || '—'}</span>
            <span className="col-span-5 truncate font-body text-sm text-ink-primary max-md:col-span-5">
              {row.label}
              {row.lockedIn.length > 0 ? (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-indicator">
                  {row.lockedIn.map((task) => TASK_LABEL[task]).join(', ')}
                </span>
              ) : null}
            </span>
            <span className="col-span-4 max-md:col-span-6">
              <span className="block h-1.5 overflow-hidden rounded-sm bg-bench-secondary">
                <motion.span
                  className={`block h-full rounded-sm ${row.rank === 1 ? 'bg-indicator' : 'bg-ink-primary'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(1, row.quality)) * 100}%` }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
                />
              </span>
              <span className="mt-1 block font-mono text-[10px] tabular-nums text-ink-muted">
                QUALITY {formatShare(row.quality)} · VALUE {formatShare(row.costEfficiency)} · SPEED {formatShare(row.latencyReliability)}
              </span>
            </span>
            <span className="col-span-2 text-right font-mono text-xs tabular-nums text-ink-secondary max-md:col-span-6">
              {row.observations} OBS
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-secondary">LOCKS PER TASK TYPE</p>
      <div className="mt-3" data-testid="locks">
        {TASK_TYPES.map((task) => (
          <div key={task} className="grid grid-cols-4 gap-4 border-b border-line-subtle py-3 max-md:grid-cols-1">
            <span className="font-body text-sm text-ink-primary">{TASK_LABEL[task]}</span>
            {LOCK_SLOTS.map((slot) => (
              <label key={slot} className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">{SLOT_LABEL[slot]}</span>
                <select
                  value={policy.locks[task]?.[slot] ?? ''}
                  onChange={(event) => void setLock(task, slot, event.target.value === '' ? null : event.target.value)}
                  className="focus-ring rounded-md border border-line bg-bench-surface px-3 py-2 font-mono text-xs text-ink-primary outline-none transition-colors duration-150 focus:border-indicator/50"
                >
                  <option value="">{policy.routing[task]?.[slot] ? `Auto, ${policy.routing[task]?.[slot]}` : 'Auto'}</option>
                  {policy.rows.map((row) => (
                    <option key={row.modelId} value={row.modelId}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-10 max-md:w-full">
        <PrimaryButton onClick={() => void runExport()} testId="export-policy">
          {copied ? 'COPIED' : 'EXPORT POLICY'}
          {copied ? <CheckIcon className="ml-1" /> : null}
        </PrimaryButton>
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorNote cause={error.cause} fix={error.fix} />
        </div>
      ) : null}

      <AnimatePresence>
        {toast ? (
          <motion.div
            key="policy-toast"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed bottom-6 right-6 z-50 rounded-lg border border-line bg-bench-elevated px-4 py-3 shadow-md"
            role="status"
          >
            <p className="font-mono text-xs text-ink-primary">{toast}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/**
 * Placeholder retained for the toast presence boundary, see the usage above.
 */
export const POLICY_TOAST_MS = 1800
