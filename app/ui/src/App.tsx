/**
 * The app shell.
 *
 * A sticky tabbed header over three views. The active tab carries a red
 * underline drawn with a shared layout element, so the bar slides between tabs
 * rather than jumping. View transitions run through a presence boundary, with
 * the exit shorter than the enter.
 */

import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bench } from './views/Bench'
import { History } from './views/History'
import { Policy } from './views/Policy'
import { ErrorNote } from './components/Primitives'
import { EASE, useReducedMotion } from './lib/motion'
import { AssayHostError, connectHost, listHistory, setWindowTitle } from './lib/host'

/** The three tabs, in display order. */
const TABS = [
  { id: 'bench', label: 'BENCH' },
  { id: 'history', label: 'HISTORY' },
  { id: 'policy', label: 'POLICY' },
] as const

/** One tab identifier. */
type TabId = (typeof TABS)[number]['id']

/**
 * The root component.
 * @returns The shell element.
 */
export default function App() {
  const reduced = useReducedMotion()
  const [tab, setTab] = useState<TabId>('bench')
  const [connectError, setConnectError] = useState<{ cause: string; fix: string } | null>(null)
  const [connected, setConnected] = useState(false)
  const [trialsThisMonth, setTrialsThisMonth] = useState<number | null>(null)

  /**
   * Reconnects the bundle to the host.
   * @returns Nothing.
   */
  const connect = useCallback(async () => {
    try {
      const view = await connectHost()
      setConnected(true)
      setConnectError(null)
      if (view === 'history' || view === 'policy' || view === 'bench') setTab(view)
    } catch (error) {
      setConnected(false)
      if (error instanceof AssayHostError) {
        setConnectError({ cause: error.cause, fix: error.fix })
      } else {
        setConnectError({ cause: 'The window could not reach Anna.', fix: 'Reopen Assay from inside Anna.' })
      }
    }
  }, [])

  useEffect(() => {
    void connect()
  }, [connect])

  /**
   * Reads the run counter from the ledger.
   * @returns Nothing.
   */
  const readCounter = useCallback(async () => {
    if (!connected) return
    try {
      const { total } = await listHistory(200)
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      setTrialsThisMonth(total)
    } catch {
      setTrialsThisMonth(null)
    }
  }, [connected])

  useEffect(() => {
    void readCounter()
  }, [readCounter, tab])

  useEffect(() => {
    void setWindowTitle(tab === 'bench' ? 'Assay' : `Assay, ${tab}`)
  }, [tab])

  const body = useMemo(() => {
    if (tab === 'history') return <History onGoToBench={() => setTab('bench')} />
    if (tab === 'policy') return <Policy />
    return <Bench />
  }, [tab])

  return (
    <div className="min-h-[100dvh] bg-bench-primary font-body text-ink-primary">
      <div className="grain" aria-hidden="true" />

      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-line bg-bench-primary/90 px-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <img src="./logo.png" alt="Assay" width={20} height={20} className="shrink-0" />
            <span className="font-display text-base font-black tracking-[-0.02em] text-ink-primary">ASSAY</span>
          </span>
          <nav className="flex items-center gap-1" aria-label="Assay views">
            {TABS.map((entry) => {
              const active = connected && entry.id === tab
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  disabled={!connected}
                  aria-current={active ? 'page' : undefined}
                  className={`focus-ring relative rounded-md px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                    active
                      ? 'border border-line bg-bench-surface text-ink-primary'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  {entry.label}
                  {active ? (
                    <motion.span
                      layoutId="assay-tab-underline"
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-[1px] bg-indicator"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  ) : null}
                </button>
              )
            })}
          </nav>
        </div>
        <p className="hidden font-mono text-[11px] text-ink-muted sm:block">
          TRIALS THIS MONTH: {trialsThisMonth ?? '—'}
        </p>
      </header>

      {/*
        The views mount only after the handshake. A view that mounts first
        would call the tool before there is a client to call it with, and would
        report a connection failure as a product failure.
      */}
      {connectError ? (
        <div className="mx-auto max-w-5xl px-4 pt-8 md:px-6">
          <ErrorNote cause={connectError.cause} fix={connectError.fix} onRetry={connect} retryLabel="RECONNECT" />
        </div>
      ) : null}

      {!connectError && !connected ? (
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-6" data-testid="shell-connecting">
          <div className="h-2 w-24 rounded-sm bg-bench-secondary shimmer" />
          <div className="mt-6 h-32 w-full rounded-lg bg-bench-secondary shimmer" />
        </div>
      ) : null}

      {connected ? (
        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            initial={reduced ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)', y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)', y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: tab === 'bench' ? 0.3 : 0.18, ease: EASE }}
          >
            {body}
          </motion.main>
        </AnimatePresence>
      ) : null}
    </div>
  )
}
