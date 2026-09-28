/**
 * Small shared presentational pieces.
 *
 * Empty states, inline errors, rubric bars and the toast. All of them read
 * from the design system, none of them hardcode a colour.
 */

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { ArrowIcon } from './Icon'
import { rubricRows } from '../lib/format'
import type { RubricScores } from '../lib/types'

/**
 * A bordered callout used for empty states, with one primary action.
 * @param title The headline.
 * @param body One line of supporting copy.
 * @param action The action label, omitted when there is nothing to do.
 * @param onAction The action handler.
 * @returns The callout.
 */
export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string
  body: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-lg border border-dashed border-line p-10 text-center" data-testid="empty-state">
      <p className="font-body text-base font-medium text-ink-primary">{title}</p>
      <p className="mt-2 font-body text-sm text-ink-secondary">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="focus-ring mt-5 inline-block font-mono text-xs uppercase tracking-[0.1em] text-indicator underline underline-offset-4 transition-colors duration-200 hover:text-indicator-hover"
        >
          {action}
        </button>
      ) : null}
    </div>
  )
}

/**
 * An inline error carrying the cause and the fix.
 *
 * Never a bare code, never a stack. A retry action is offered when there is
 * something to retry.
 * @param cause What went wrong.
 * @param fix What to do about it.
 * @param onRetry Optional retry handler.
 * @param retryLabel The retry button label.
 * @returns The error block.
 */
export function ErrorNote({
  cause,
  fix,
  onRetry,
  retryLabel = 'TRY AGAIN',
}: {
  cause: string
  fix: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div
      role="alert"
      data-testid="error-note"
      className="rounded-lg border border-verdict-fail/40 bg-bench-surface p-4"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-verdict-fail">TRIAL HALTED</p>
      <p className="mt-2 font-body text-sm text-ink-primary">{cause}</p>
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-secondary">{fix}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring mt-3 border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-primary transition-colors duration-200 hover:border-ink-secondary"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

/**
 * The five rubric bars for one column.
 *
 * Colour is never the only signal, every bar is paired with its numeric score.
 * @param scores The rubric scores for one column.
 * @param leader Whether this column won on quality, which turns the fill red.
 * @returns The bar block.
 */
export function RubricBars({ scores, leader = false }: { scores: RubricScores; leader?: boolean }) {
  return (
    <div data-testid="rubric-bars">
      {rubricRows(scores).map((row) => (
        <div key={row.key}>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">{row.label}</span>
            <span className="font-mono text-[10px] tabular-nums text-ink-secondary">{row.score.toFixed(1)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-bench-secondary">
            <motion.div
              className={`h-full rounded-sm ${leader ? 'bg-indicator' : 'bg-ink-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: row.width }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * A pill button with the trailing icon circle, the button-in-button pattern.
 * @param children The label.
 * @param onClick The handler.
 * @param disabled Whether the button is disabled.
 * @param type The button type attribute.
 * @returns The button.
 */
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
  testId,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  testId?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="focus-ring group inline-flex items-center gap-3 rounded-full bg-ink-primary px-7 py-3.5 font-mono text-sm uppercase tracking-[0.08em] text-bench-elevated transition-colors duration-200 hover:bg-indicator hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-px" />
      </span>
    </button>
  )
}

/**
 * A transient message anchored bottom right.
 * @param message The text, or null when nothing is showing.
 * @param onDone Called when the toast should clear itself.
 * @returns The toast, or null.
 */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(onDone, 3000)
    return () => window.clearTimeout(timer)
  }, [message, onDone])

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          data-testid="toast"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 right-6 z-50 rounded-lg border border-line bg-bench-elevated px-4 py-3 shadow-md"
        >
          <p className="font-mono text-xs text-ink-primary">{message}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * A double bezel card. The inner radius is always smaller than the outer.
 * @param children The card contents.
 * @param className Extra classes on the outer frame.
 * @returns The card.
 */
export function DoubleBezel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-tile p-2 ring-1 ring-line-subtle ${className}`} style={{ background: 'var(--bg-secondary)' }}>
      <div className="rounded-lg bg-bench-elevated p-5 shadow-tile">{children}</div>
    </div>
  )
}
