/**
 * The ledger.
 *
 * A list of past trials, newest first, and a read only detail view that
 * reuses the verdict and unblind layouts. Selecting a row slides the detail in
 * from the right. The list never shows a name for an un-unblinded trial.
 */

import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { BackIcon, ChevronIcon } from '../components/Icon'
import { EmptyState, ErrorNote, RubricBars } from '../components/Primitives'
import { EASE, useReducedMotion } from '../lib/motion'
import { formatCost, formatDate, formatLatency, formatTime } from '../lib/format'
import { AssayHostError, getHistory, listHistory } from '../lib/host'
import type { Letter, TrialDetail, TrialSummary } from '../lib/types'

/**
 * Converts a host error into the two lines an inline error shows.
 * @param error The thrown value.
 * @returns The cause and the fix.
 */
function readError(error: unknown): { cause: string; fix: string } {
  if (error instanceof AssayHostError) return { cause: error.cause, fix: error.fix }
  return { cause: 'The ledger could not be read.', fix: 'Reopen the Assay window to retry.' }
}

/**
 * The ledger screen.
 * @param onGoToBench Switches the shell to the bench tab.
 * @returns The ledger element.
 */
export function History({ onGoToBench }: { onGoToBench: () => void }) {
  const reduced = useReducedMotion()
  const [rows, setRows] = useState<TrialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: string; fix: string } | null>(null)
  const [detail, setDetail] = useState<TrialDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  /**
   * Loads the ledger, newest first.
   * @returns Nothing.
   */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { trials } = await listHistory(50)
      setRows(trials)
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

  /**
   * Opens one trial in the read only detail view.
   * @param trialId The trial identifier.
   * @returns Nothing.
   */
  const open = async (trialId: string) => {
    setDetailLoading(true)
    try {
      const { trial } = await getHistory(trialId)
      setDetail(trial)
      setError(null)
    } catch (caught) {
      setError(readError(caught))
    } finally {
      setDetailLoading(false)
    }
  }

  if (detail) {
    return <TrialDetailView trial={detail} onBack={() => setDetail(null)} reduced={reduced} />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6" data-testid="history">
      <h2 className="mb-6 font-display text-2xl font-black uppercase tracking-[-0.02em] text-ink-primary">LEDGER</h2>

      {loading ? (
        <div className="space-y-3" data-testid="history-loading">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-14 w-full rounded-md bg-bench-secondary shimmer" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No verdicts yet"
          body="Your first blind trial takes about a minute."
          action="GO TO THE BENCH"
          onAction={onGoToBench}
        />
      ) : (
        <div className="divide-y divide-line-subtle border-y border-line-subtle">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => void open(row.id)}
              className="focus-ring group grid w-full grid-cols-12 items-center gap-4 rounded-md px-2 py-4 text-left transition-colors duration-200 hover:bg-bench-surface max-md:grid-cols-6"
            >
              <span className="col-span-3 font-mono text-xs text-ink-muted max-md:col-span-6">
                {formatDate(row.createdAt)} {formatTime(row.createdAt)}
              </span>
              <span className="col-span-4 truncate font-body text-sm text-ink-primary max-md:col-span-6">{row.workloadExcerpt}</span>
              <span
                className={`col-span-2 truncate font-mono text-xs uppercase max-md:col-span-3 ${
                  row.winner ? 'text-indicator' : 'text-ink-secondary'
                }`}
              >
                {row.winner ?? (row.unblinded ? 'TIE' : 'SEALED')}
              </span>
              <span className="col-span-2 text-right font-mono text-xs tabular-nums text-ink-secondary max-md:col-span-3">
                {formatCost(row.totalCostUsd)}
              </span>
              <ChevronIcon className="col-span-1 justify-self-end text-ink-muted transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      )}

      {detailLoading ? (
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted" role="status">
          OPENING TRIAL
        </p>
      ) : null}

      {error ? (
        <div className="mt-6">
          <ErrorNote cause={error.cause} fix={error.fix} onRetry={load} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * One trial, read only, with the reveal shown when it happened.
 * @param trial The stored record.
 * @param onBack Returns to the list.
 * @param reduced Whether the user asked for reduced motion.
 * @returns The detail element.
 */
function TrialDetailView({ trial, onBack, reduced }: { trial: TrialDetail; onBack: () => void; reduced: boolean }) {
  const letters = Object.keys(trial.results)
  const labels: Record<Letter, string> = {}
  for (const column of trial.revealed) labels[column.letter] = column.label

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
      animate={reduced ? { opacity: 1 } : { opacity: 0, x: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="mx-auto max-w-5xl px-4 py-10 md:px-6"
      data-testid="history-detail"
    >
      <button
        type="button"
        onClick={onBack}
        className="focus-ring inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-ink-secondary transition-colors duration-200 hover:text-ink-primary"
      >
        <BackIcon /> BACK TO THE LEDGER
      </button>

      <h2 className="mb-1 mt-6 font-display text-2xl font-black uppercase tracking-[-0.02em] text-ink-primary">
        {trial.crown?.letter === 'tie' ? 'A TIE, ON THE RECORD' : `CROWNED ${trial.crown?.letter ?? 'NOTHING'}`}
      </h2>
      <p className="mb-8 font-mono text-xs text-ink-muted">
        {formatDate(trial.createdAt)} {formatTime(trial.createdAt)} · RUN {formatLatency(trial.runMs)}
      </p>

      <p className="mb-8 max-w-[70ch] whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-secondary">
        TASK: {trial.workload}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {letters.map((letter) => {
          const result = trial.results[letter]
          const failed = result.state === 'failed'
          return (
            <div
              key={letter}
              className={`rounded-lg border bg-bench-surface p-5 ${
                trial.crown?.letter === letter ? 'border-indicator shadow-crown' : 'border-line'
              }`}
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-primary">
                {trial.unblinded ? labels[letter] ?? letter : letter}
              </p>
              {failed ? (
                <>
                  <p className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-verdict-fail">FAILED</p>
                  <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-secondary">{result.errorHint}</p>
                </>
              ) : trial.verdict?.scores[letter] ? (
                <div className="mt-4">
                  <RubricBars scores={trial.verdict.scores[letter]} leader={trial.verdict.qualityLeader === letter} />
                </div>
              ) : null}
              <div className="mt-4 border-t border-line-subtle pt-3">
                <p className="font-mono text-[11px] tabular-nums text-ink-secondary">
                  {formatCost(trial.verdict?.costUsd[letter] ?? result.costUsd)} / {formatLatency(result.latencyMs)}
                </p>
                {result.tokensEstimated ? (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">
                    TOKENS ESTIMATED, NOT MEASURED
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {!trial.unblinded ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 border-t border-line-subtle pt-6 font-mono text-xs text-ink-secondary"
          >
            NAMES STILL SEALED ON THIS TRIAL.
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
