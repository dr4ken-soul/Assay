/**
 * The bench, the app's default view.
 *
 * Four states, in order: setup, running, verdict, unblind. The blind holds
 * across three of them. No model name is read from, written to or rendered in
 * the DOM until the reveal, and the letter is the only identity a column has.
 */

import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon } from '../components/Icon'
import { EmptyState, ErrorNote, PrimaryButton, RubricBars } from '../components/Primitives'
import { RunningSkeleton } from '../components/Skeleton'
import { EASE, VIEWPORT, useReducedMotion } from '../lib/motion'
import { formatCost, formatLatency, formatTimer, formatTokens, formatValueRatio, divergencesFor } from '../lib/format'
import { AssayHostError, crownTrial, listRoster, startTrial, trialStatus, trialVerdict, unblindTrial } from '../lib/host'
import type { ColumnStatus, Letter, RosterEntry, TrialStarted, TrialStatus, TrialVerdict } from '../lib/types'

/** How often the bench polls a running trial. */
const POLL_MS = 500

/** The bench phase. The bench never leaves this order. */
type Phase = 'setup' | 'running' | 'verdict' | 'unblind'

/**
 * Converts a host error into the two lines an inline error shows.
 * @param error The thrown value.
 * @returns The cause and the fix.
 */
function readError(error: unknown): { cause: string; fix: string } {
  if (error instanceof AssayHostError) return { cause: error.cause, fix: error.fix }
  return { cause: 'Something went wrong on the bench.', fix: 'Reopen the Assay window and try again.' }
}

/**
 * The bench screen.
 * @returns The bench element.
 */
export function Bench() {
  const reduced = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('setup')
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [workload, setWorkload] = useState('')
  const [started, setStarted] = useState<TrialStarted | null>(null)
  const [status, setStatus] = useState<TrialStatus | null>(null)
  const [verdict, setVerdict] = useState<TrialVerdict | null>(null)
  const [revealed, setRevealed] = useState<Record<Letter, string> | null>(null)
  const [crowned, setCrowned] = useState<Letter | 'tie' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ cause: string; fix: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const runStarted = useRef<number>(0)

  /**
   * Loads the roster. Runs once on mount.
   * @returns Nothing.
   */
  const loadRoster = useCallback(async () => {
    setRosterLoading(true)
    try {
      const { roster: entries } = await listRoster()
      setRoster(entries)
      setSelected((current) => (current.length > 0 ? current : entries.slice(0, 3).map((entry) => entry.id)))
    } catch (caught) {
      setError(readError(caught))
    } finally {
      setRosterLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  /**
   * Toggles one model on the bench.
   * @param id The roster identifier.
   * @returns Nothing.
   */
  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  /**
   * Starts a trial and moves the bench into the running state.
   * @returns Nothing.
   */
  const run = async () => {
    setBusy(true)
    setError(null)
    setVerdict(null)
    setRevealed(null)
    setCrowned(null)
    setStatus(null)
    try {
      const result = await startTrial(workload.trim(), selected)
      setStarted(result)
      setPhase('running')
      runStarted.current = Date.now()
      setElapsed(0)
    } catch (caught) {
      setError(readError(caught))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Polls the running trial, then asks for the verdict exactly once it settles.
   *
   * The verdict is requested at most once per run. The examiner already re-asks
   * internally on invalid JSON, so a second attempt from here would be retry
   * theatre, and an unguarded loop turns one examiner failure into an unbounded
   * stream of billed calls against the user's own quota.
   *
   * @returns Nothing.
   */
  useEffect(() => {
    if (phase !== 'running' || !started) return undefined

    let cancelled = false
    let verdictSettled = false

    const poll = async () => {
      try {
        const next = await trialStatus(started.trialId)
        if (cancelled) return
        setStatus(next)
        if (next.state !== 'settled' || verdictSettled) return

        // Claim the single attempt before awaiting, so a slow response cannot
        // be joined by the next tick firing a second one.
        verdictSettled = true
        setBusy(true)
        try {
          const scored = await trialVerdict(started.trialId)
          if (cancelled) return
          setVerdict(scored)
          setPhase('verdict')
        } catch (caught) {
          if (!cancelled) setError(readError(caught))
        } finally {
          if (!cancelled) setBusy(false)
        }
      } catch (caught) {
        if (!cancelled) setError(readError(caught))
      }
    }

    const timer = window.setInterval(poll, POLL_MS)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [phase, started])

  /**
   * Ticks the live timers at 10Hz while a trial is running.
   * @returns Nothing.
   */
  useEffect(() => {
    if (phase !== 'running') return undefined
    const timer = window.setInterval(() => setElapsed(Date.now() - runStarted.current), 100)
    return () => window.clearInterval(timer)
  }, [phase])

  /**
   * Records the blind crown, then lifts the blind.
   * @param letter The winning column, or the word `tie`.
   * @returns Nothing.
   */
  const crown = async (letter: Letter | 'tie') => {
    if (!started) return
    setBusy(true)
    setError(null)
    try {
      const result = await crownTrial(started.trialId, letter)
      setCrowned(result.crowned)
      const reveal = await unblindTrial(started.trialId)
      const map: Record<Letter, string> = {}
      for (const column of reveal.revealed) map[column.letter] = column.label
      setRevealed(map)
      setPhase('unblind')
    } catch (caught) {
      setError(readError(caught))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Returns the bench to setup for another trial.
   * @returns Nothing.
   */
  const reset = () => {
    setPhase('setup')
    setStarted(null)
    setStatus(null)
    setVerdict(null)
    setRevealed(null)
    setCrowned(null)
    setError(null)
  }

  const letters = started?.letters ?? []
  const canRun = selected.length >= 2 && workload.trim().length >= 8 && !busy

  if (rosterLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6" data-testid="bench-loading">
        <div className="h-2 w-24 rounded-sm bg-bench-secondary shimmer" />
        <div className="mt-6 space-y-3">
          <div className="h-32 w-full rounded-lg bg-bench-secondary shimmer" />
          <div className="h-10 w-full rounded-lg bg-bench-secondary shimmer" />
        </div>
      </div>
    )
  }

  if (roster.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        {error ? (
          <ErrorNote cause={error.cause} fix={error.fix} onRetry={loadRoster} retryLabel="RELOAD BENCH" />
        ) : (
          <EmptyState
            title="No models on the bench yet"
            body="Add provider keys in Anna settings or run on Anna credits. Assay reads whatever Anna already holds."
            action="OPEN ANNA SETTINGS"
          />
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6" data-testid={`bench-${phase}`} data-phase={phase}>
      {/*
        The four bench states swap hard, they do not overlap.
        A presence boundary would keep the setup section, and the roster chips
        on it, mounted through the exit. That would put a model name in the DOM
        while the trial runs, which is exactly what this product promises
        never happens. One state in the DOM at a time, and each state carries
        its own entrance.
      */}
      {phase === 'setup' ? (
          <motion.section
            key="setup"
            initial={reduced ? { opacity: 0 } : { filter: 'blur(10px)', opacity: 0, y: 20 }}
            animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0.3 : 0.3, ease: EASE }}
          >
            <label htmlFor="workload" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-ink-secondary">
              WORKLOAD
            </label>
            <textarea
              id="workload"
              value={workload}
              onChange={(event) => setWorkload(event.target.value)}
              placeholder="Paste the task you actually run. Include the real constraints, the real format, the real tone."
              className="focus-ring min-h-[160px] w-full rounded-lg border border-line bg-bench-surface p-4 font-mono text-sm leading-relaxed text-ink-primary outline-none transition-colors duration-150 placeholder:text-ink-muted focus:border-indicator/50 focus:ring-2 focus:ring-indicator-glow"
            />

            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-secondary">MODELS ON TRIAL</p>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="roster">
              {roster.map((entry) => {
                const isSelected = selected.includes(entry.id)
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => toggle(entry.id)}
                    aria-pressed={isSelected}
                    className={`focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2.5 font-mono text-xs transition-all duration-200 ${
                      isSelected
                        ? 'border-ink-primary bg-ink-primary text-bench-elevated'
                        : 'border-line bg-transparent text-ink-secondary hover:border-ink-secondary'
                    }`}
                  >
                    <AnimatePresence>
                      {isSelected ? (
                        <motion.span
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="inline-flex"
                        >
                          <CheckIcon />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                    {entry.label}
                    <span className="text-[10px] uppercase tracking-[0.15em] opacity-60">
                      {entry.source === 'anna' ? 'ANNA' : entry.hasKey ? 'KEY' : 'NO KEY'}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 font-mono text-[11px] text-ink-muted">PICK AT LEAST TWO. THE BLIND NEEDS COMPANY.</p>

            <div className="mt-8">
              <PrimaryButton onClick={run} disabled={!canRun} testId="run-trial">
                RUN BLIND TRIAL
              </PrimaryButton>
            </div>

            {error ? (
              <div className="mt-6">
                <ErrorNote cause={error.cause} fix={error.fix} onRetry={loadRoster} retryLabel="RELOAD BENCH" />
              </div>
            ) : null}
          </motion.section>
        ) : null}

        {phase === 'running' ? (
          <motion.section
            key="running"
            initial={reduced ? { opacity: 0 } : { filter: 'blur(6px)', opacity: 0, y: 8 }}
            animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="mb-6 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indicator" />
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-secondary">RUNNING. NAMES SEALED.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {letters.map((letter, index) => (
                <RunningColumn key={letter} letter={letter} status={columnFor(status, letter)} elapsed={elapsed} seed={index} />
              ))}
            </div>
            {error ? (
              <div className="mt-6">
                <ErrorNote cause={error.cause} fix={error.fix} />
              </div>
            ) : null}
          </motion.section>
        ) : null}

        {phase === 'verdict' && verdict ? (
          <motion.section
            key="verdict"
            initial={reduced ? { opacity: 0 } : { filter: 'blur(10px)', opacity: 0, y: 20 }}
            animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <h2 className="mb-2 font-display text-2xl font-black uppercase tracking-[-0.02em] text-ink-primary">THE BLIND VERDICT</h2>
            <p className="mb-8 font-mono text-xs text-ink-muted">CROWN A WINNER BEFORE THE REVEAL</p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="verdict-columns">
              {letters.map((letter, index) => {
                const column = status?.columns.find((entry) => entry.letter === letter)
                const failed = column?.state === 'failed'
                return (
                  <div
                    key={letter}
                    className="rounded-lg border border-line bg-bench-surface p-5"
                    data-testid={`verdict-${letter}`}
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-secondary">{letter}</p>
                    {failed ? (
                      <>
                        <p className="mt-4 font-mono text-xs uppercase tracking-[0.15em] text-verdict-fail">FAILED</p>
                        <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-secondary" data-testid={`failed-hint-${letter}`}>
                          {column?.errorHint ?? 'the column did not return, run it again to see the cause'}
                        </p>
                        <p className="mt-4 border-t border-line-subtle pt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted">
                          EXCLUDED FROM THE VERDICT
                        </p>
                      </>
                    ) : (
                      <>
                        {verdict.verdict.scores[letter] ? (
                          <RubricBars scores={verdict.verdict.scores[letter]} leader={verdict.verdict.qualityLeader === letter} />
                        ) : (
                          <div className="mt-4">
                            <RunningSkeleton seed={index} />
                          </div>
                        )}
                        <div className="mt-4 border-t border-line-subtle pt-3">
                          <p className="font-mono text-[11px] tabular-nums text-ink-secondary">
                            {formatCost(verdict.verdict.costUsd[letter] ?? null)} / {formatLatency(verdict.verdict.latencyMs[letter] ?? 0)}
                          </p>
                          <p className="mt-1 font-mono text-[11px] tabular-nums text-ink-muted">
                            {formatValueRatio(verdict.verdict.valueRatio[letter] ?? null)}
                          </p>
                        </div>
                        {divergencesFor(verdict.verdict.divergences, letter).map((note) => (
                          <p key={note} className="mt-4 font-mono text-[11px] leading-relaxed text-ink-secondary">
                            VS: {note}
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {verdict.verdict.examinerNotes ? (
              <p className="mt-6 max-w-[70ch] font-body text-sm leading-relaxed text-ink-secondary">
                {verdict.verdict.examinerNotes}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3" data-testid="crown-row">
              {letters.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => void crown(letter)}
                  disabled={busy}
                  aria-label={`Crown ${letter} as the winner`}
                  className="focus-ring rounded-full border border-ink-primary px-5 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-ink-primary transition-colors duration-200 hover:bg-ink-primary hover:text-bench-elevated disabled:cursor-not-allowed disabled:opacity-40"
                >
                  CROWN {letter.replace('MODEL ', '')}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void crown('tie')}
                disabled={busy}
                className="focus-ring ml-auto rounded-full border border-dashed border-line px-5 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-ink-secondary transition-colors duration-200 hover:border-ink-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                CALL IT A TIE
              </button>
            </div>

            {error ? (
              <div className="mt-6">
                <ErrorNote cause={error.cause} fix={error.fix} />
              </div>
            ) : null}
          </motion.section>
        ) : null}

        {phase === 'unblind' && verdict ? (
          <motion.section
            key="unblind"
            initial={reduced ? { opacity: 0 } : { filter: 'blur(10px)', opacity: 0, y: 20 }}
            animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <h2 className="mb-2 font-display text-2xl font-black uppercase tracking-[-0.02em] text-ink-primary">THE REVEAL</h2>
            <p className="mb-8 font-mono text-xs text-ink-muted">
              {crowned === 'tie' ? 'YOU CALLED IT A TIE. BOTH ANSWERS STAY ON THE RECORD.' : `YOU CROWNED ${crowned}.`}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {letters.map((letter, index) => (
                <motion.div
                  key={letter}
                  initial={reduced ? { opacity: 0 } : { rotateY: 90, opacity: 0 }}
                  animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
                  transition={
                    reduced
                      ? { duration: 0.3 }
                      : { type: 'spring', stiffness: 260, damping: 24, delay: 0.15 * index }
                  }
                  className={`rounded-lg border bg-bench-surface p-5 ${
                    crowned === letter ? 'border-indicator shadow-crown' : 'border-line'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-primary" data-testid={`revealed-${letter}`}>
                      {revealed?.[letter] ?? letter}
                    </p>
                    {crowned === letter ? (
                      <span className="-rotate-2 rounded-sm border-2 border-indicator px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em] text-indicator">
                        YOUR PICK
                      </span>
                    ) : null}
                  </div>
                  {verdict.verdict.scores[letter] ? (
                    <div className="mt-4">
                      <RubricBars scores={verdict.verdict.scores[letter]} leader={verdict.verdict.qualityLeader === letter} />
                    </div>
                  ) : null}
                  <div className="mt-4 border-t border-line-subtle pt-3">
                    <p className="font-mono text-[11px] tabular-nums text-ink-secondary">
                      {formatCost(verdict.verdict.costUsd[letter] ?? null)} / {formatLatency(verdict.verdict.latencyMs[letter] ?? 0)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 border-t border-line-subtle pt-6">
              <p className="font-mono text-xs text-ink-secondary">RECORDED TO YOUR LEDGER. POLICY WEIGHTS SHIFTED.</p>
            </div>

            <div className="mt-8">
              <PrimaryButton onClick={reset} testId="run-another">
                RUN ANOTHER TRIAL
              </PrimaryButton>
            </div>
          </motion.section>
        ) : null}

      {busy && phase !== 'running' ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted"
          role="status"
        >
          THE EXAMINER IS READING
        </motion.p>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {phase === 'verdict' ? 'The blind verdict is ready. Crown a winner before the reveal.' : ''}
      </span>
    </div>
  )
}

/**
 * Reads one column's live state.
 * @param status The current trial status, or null before the first poll.
 * @param letter The column letter.
 * @returns The column state, or null.
 */
function columnFor(status: TrialStatus | null, letter: Letter): ColumnStatus | null {
  return status?.columns.find((entry) => entry.letter === letter) ?? null
}

/**
 * One anonymised column while the trial runs.
 * @param letter The column letter.
 * @param status The live column state, null before the first poll.
 * @param elapsed Milliseconds since the run started, for the live timer.
 * @param seed The column index, so the shimmer patterns differ.
 * @returns The column element.
 */
function RunningColumn({ letter, status, elapsed, seed }: { letter: Letter; status: ColumnStatus | null; elapsed: number; seed: number }) {
  const failed = status?.state === 'failed'
  const settled = status?.state === 'ok'

  return (
    <div
      className={`rounded-lg border bg-bench-surface p-5 ${failed ? 'border-verdict-fail/40' : 'border-line'}`}
      data-testid={`column-${letter}`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-secondary">{letter}</p>

      {failed ? (
        <>
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-verdict-fail">FAILED</p>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
            {status?.errorHint ?? 'the column did not return, run it again to see the cause'}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 font-mono text-2xl tabular-nums text-ink-primary" data-testid={`timer-${letter}`}>
            {formatTimer(settled ? (status?.latencyMs ?? 0) : elapsed)}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-ink-muted" data-testid={`cost-${letter}`}>
            {formatCost(status?.costUsd ?? null)}
          </p>
          {settled ? (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted">
              ANSWER RECEIVED, {formatTokens(status?.tokensOut ?? 0)} TOKENS OUT
            </p>
          ) : (
            <div className="mt-4">
              <RunningSkeleton seed={seed} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** The viewport rule, re-exported so the bench and the spec agree in one place. */
export { VIEWPORT }
