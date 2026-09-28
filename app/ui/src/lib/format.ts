/**
 * Formatting helpers.
 *
 * Every number the bench shows passes through here, so a figure is never
 * invented at the call site and a null cost is never rendered as zero.
 */

import type { Letter, RubricScores } from './types'
import { RUBRIC_AXES } from './types'

/**
 * Formats a measured cost, or the reason there is not one.
 * @param costUsd The cost in USD, or null when it is not knowable.
 * @returns A four decimal dollar string, or the honest alternative.
 */
export function formatCost(costUsd: number | null | undefined): string {
  if (costUsd === null || costUsd === undefined) return 'ANNA CREDITS'
  if (costUsd === 0) return '$0.0000'
  return `$${costUsd.toFixed(4)}`
}

/**
 * Formats a latency in seconds.
 * @param latencyMs The measured wall clock in milliseconds.
 * @returns A one decimal second string, for example `3.9s`.
 */
export function formatLatency(latencyMs: number): string {
  return `${(Math.max(0, latencyMs) / 1000).toFixed(1)}s`
}

/**
 * Formats a running timer.
 * @param latencyMs The elapsed milliseconds.
 * @returns A two decimal second string, for example `02.41s`.
 */
export function formatTimer(latencyMs: number): string {
  return `${(Math.max(0, latencyMs) / 1000).toFixed(2)}s`
}

/**
 * Formats a token count.
 * @param tokens The token count.
 * @returns A grouped integer string.
 */
export function formatTokens(tokens: number): string {
  return new Intl.NumberFormat('en-GB').format(Math.max(0, Math.round(tokens)))
}

/**
 * Formats a quality share as a percentage.
 * @param share The share, 0 to 1.
 * @returns A whole number percentage string.
 */
export function formatShare(share: number): string {
  return `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`
}

/**
 * Formats a value ratio.
 * @param ratio Quality points per dollar, or null when cost is unknown.
 * @returns A grouped integer string, or the honest alternative.
 */
export function formatValueRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return 'NO COST BASIS'
  return `${new Intl.NumberFormat('en-GB').format(Math.round(ratio))} PT/$`
}

/**
 * Formats a short date for a ledger row.
 * @param iso The ISO timestamp.
 * @returns A day and month string, for example `28 Sep`.
 */
export function formatDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'UNKNOWN DATE'
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

/**
 * Formats a time of day for a ledger row.
 * @param iso The ISO timestamp.
 * @returns A 24 hour clock string, for example `10:02`.
 */
export function formatTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '--:--'
  return parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Clamps a rubric score into the 0 to 5 range.
 * @param value The raw score from the examiner.
 * @returns A number in the range 0 to 5.
 */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(5, value))
}

/**
 * The bar width for one rubric score, as a percentage string.
 * @param value The score, 0 to 5.
 * @returns A CSS width percentage.
 */
export function scoreWidth(value: number): string {
  return `${(clampScore(value) / 5) * 100}%`
}

/**
 * The five axes of a verdict column, in display order.
 * @param scores The rubric scores for one column.
 * @returns One row per axis, label, score and bar width.
 */
export function rubricRows(scores: RubricScores): Array<{ key: string; label: string; score: number; width: string }> {
  return RUBRIC_AXES.map((axis) => ({
    key: axis.key,
    label: axis.label,
    score: clampScore(scores[axis.key]),
    width: scoreWidth(scores[axis.key]),
  }))
}

/**
 * The divergence notes that involve one column, in the examiner's order.
 * @param divergences The verdict divergence list.
 * @param letter The column being read.
 * @returns The notes, prefixed ready to render.
 */
export function divergencesFor(
  divergences: Array<{ between: [Letter, Letter]; note: string }>,
  letter: Letter,
): string[] {
  return divergences.filter((entry) => entry.between.includes(letter)).map((entry) => entry.note)
}

/**
 * The other column in a divergence pair.
 * @param between The pair.
 * @param letter The column being read.
 * @returns The counterpart letter.
 */
export function counterpart(between: [Letter, Letter], letter: Letter): Letter {
  return between[0] === letter ? between[1] : between[0]
}

/**
 * Trims text to a whole word boundary.
 * @param text The text to trim.
 * @param limit The character ceiling.
 * @returns The trimmed text with an ellipsis when it was cut.
 */
export function excerpt(text: string, limit: number): string {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
