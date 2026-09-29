/**
 * The blind DOM check.
 *
 * This is the product's core promise, so it gets a test rather than a hope.
 * While a trial is running and while the blind verdict is on screen, no model
 * name, model id or provider handle may appear anywhere in the rendered DOM.
 * Only after the crown and the reveal may the names appear, and then only in
 * the columns they belong to.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Bench } from '../src/views/Bench'
import { installHostClient } from '../src/lib/host'
import { FORBIDDEN_BEFORE_UNBLIND, makeFakeHost, type FakeHost } from './fakeHost'

/** The bench poll interval, mirrored from Bench.tsx. */
const POLL_MS = 500

/** The roster selection the setup state starts on. */
const WORKLOAD = 'Summarise this incident in three lines for a paying customer.'

/** The host installed for the current test. */
let host: FakeHost

/**
 * Collects the visible text and the attribute values under a root, skipping
 * any subtree that matches the ignore selector.
 * @param root The element to walk.
 * @param ignoreSelector A selector for the one subtree allowed to carry a name.
 * @returns The joined text and attribute values.
 */
function collectVisible(root: Element, ignoreSelector?: string): string {
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element
    if (ignoreSelector && element.matches(ignoreSelector)) return
    for (const attribute of Array.from(element.attributes)) {
      parts.push(`${attribute.name}=${attribute.value}`)
    }
    for (const child of Array.from(node.childNodes)) walk(child)
  }
  for (const child of Array.from(root.childNodes)) walk(child)
  return parts.join(' ').toLowerCase()
}

/**
 * Asserts that the rendered document carries no model identity.
 * @param label The state being checked, for the failure message.
 * @param ignoreSelector A selector for the one subtree that is allowed to
 *   carry a name, the roster chips in the setup state.
 * @returns Nothing.
 */
function assertBlind(label: string, ignoreSelector?: string) {
  const haystack = collectVisible(document.body, ignoreSelector)
  for (const term of FORBIDDEN_BEFORE_UNBLIND) {
    expect(haystack.includes(term.toLowerCase()), `${label}: the DOM shows "${term}"`).toBe(false)
  }
}

/**
 * Puts the bench into the running state.
 * @returns Nothing.
 */
async function startRun() {
  fireEvent.change(await screen.findByLabelText('WORKLOAD'), { target: { value: WORKLOAD } })
  const run = await screen.findByTestId('run-trial')
  await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(run)
}

/**
 * Waits for the verdict state and for the running state to finish leaving.
 *
 * The presence boundary keeps the outgoing section mounted through its exit,
 * so asserting on the verdict alone would also read the running columns.
 * @returns Nothing.
 */
async function gotoVerdict() {
  await screen.findByTestId('bench-verdict', undefined, { timeout: 5000 })
  await waitFor(() => expect(screen.queryByTestId('bench-running')).toBeNull())
}

beforeEach(() => {
  host = makeFakeHost()
  installHostClient(host.client)
})

afterEach(() => {
  cleanup()
  installHostClient(null)
})

describe('the blind', () => {
  it('shows no model name in the setup state, outside the chips the user picks from', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    // The roster is the one place a name is allowed before the run, it is the
    // user's own selection surface, not a result.
    const roster = screen.getByTestId('roster')
    expect(roster.textContent).toContain('GPT-4o')
    assertBlind('setup state', '[data-testid="roster"]')
  })

  it('shows no model name while the trial is running', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()
    await screen.findByTestId('bench-running')
    assertBlind('running state')
    expect(document.body.textContent).toContain('RUNNING. NAMES SEALED.')
  })

  it('shows no model name while the blind verdict is on screen', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()
    await gotoVerdict()
    assertBlind('verdict state')
    expect(document.body.textContent).toContain('THE BLIND VERDICT')
  })

  it('reveals the names only after the crown', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()
    await gotoVerdict()

    const crown = screen.getByLabelText('Crown MODEL A as the winner')
    fireEvent.click(crown)
    await screen.findByTestId('bench-unblind', undefined, { timeout: 5000 })

    const revealedA = screen.getByTestId('revealed-MODEL A')
    expect(revealedA.textContent).toContain('Claude Sonnet 4.5')
    expect(document.body.textContent).toContain('YOUR PICK')
  })

  it('marks a failed column and keeps it out of the scored set', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()
    await gotoVerdict()

    const failed = screen.getByTestId('verdict-MODEL C')
    expect(failed.textContent).toContain('FAILED')
    expect(failed.textContent).toContain('the key for this provider was rejected')
    expect(failed.querySelector('[data-testid="rubric-bars"]')).toBeNull()
  })

  it('offers a tie and a crown for every letter, and no crown twice', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()
    await gotoVerdict()

    expect(screen.getByLabelText('Crown MODEL A as the winner')).toBeTruthy()
    expect(screen.getByLabelText('Crown MODEL B as the winner')).toBeTruthy()
    expect(screen.getByLabelText('Crown MODEL C as the winner')).toBeTruthy()
    expect(screen.getByText('CALL IT A TIE')).toBeTruthy()
  })

  it('refuses to run on a single model and says why', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    fireEvent.click(screen.getByRole('button', { name: /GPT-4o/ }))

    const run = screen.getByTestId('run-trial') as HTMLButtonElement
    expect(run.disabled).toBe(true)
    expect(screen.getByText('PICK AT LEAST TWO. THE BLIND NEEDS COMPANY.')).toBeTruthy()
  })

  it('shows the rate limit with the reset time and does not start a run', async () => {
    host.rateLimit('trial_start')
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()

    const note = await screen.findByTestId('error-note')
    expect(note.textContent).toContain('Six trials an hour')
    expect(note.textContent).toContain('top of the hour')
    expect(host.calls.some((call) => call.method === 'trial_start')).toBe(true)
  })

  it('asks the examiner exactly once when it fails, never in a loop', async () => {
    // One examiner failure must not become an unbounded stream of billed
    // calls. The judge already re-asks internally, so the UI asks once.
    host.fail('trial_verdict')
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()
    await screen.findByTestId('bench-running')
    await waitFor(() => expect(screen.getByTestId('error-note')).toBeTruthy())

    expect(host.calls.filter((call) => call.method === 'trial_verdict').length).toBe(1)

    // Let several poll intervals elapse. The count must not move.
    await new Promise((resolve) => setTimeout(resolve, POLL_MS * 6))
    expect(host.calls.filter((call) => call.method === 'trial_verdict').length).toBe(1)
  })

  it('never logs or sends a model name to the unblind path before it is crowned', async () => {
    render(<Bench />)
    await screen.findByTestId('bench-setup')
    await startRun()
    await gotoVerdict()

    const before = host.calls.length
    expect(host.calls.slice(0, before).some((call) => call.method === 'trial_unblind')).toBe(false)
  })
})
