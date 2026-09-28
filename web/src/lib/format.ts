/**
 * Format helpers for the landing page.
 *
 * A null is never rendered as a zero here. A measure that does not exist does
 * not get a card, and this module makes that awkward on purpose.
 */

/**
 * Formats a cost, or the honest alternative when there is none.
 * @param usd The cost in USD.
 * @returns A four decimal dollar string, or the Anna credits label.
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return 'ANNA CREDITS'
  return `$${usd.toFixed(4)}`
}

/**
 * Formats a date for a ledger line.
 * @param iso The ISO timestamp.
 * @returns A day and month string.
 */
export function formatDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'UNKNOWN DATE'
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Formats a latency in seconds.
 * @param ms The measured milliseconds.
 * @returns A one decimal second string.
 */
export function formatLatency(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`
}
