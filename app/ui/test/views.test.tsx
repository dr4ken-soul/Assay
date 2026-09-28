/**
 * Ledger, policy and formatting tests.
 *
 * The ledger must not name a winner before the unblind. The policy must round
 * trip. Every formatter must refuse to invent a number.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { History } from '../src/views/History'
import { Policy } from '../src/views/Policy'
import { installHostClient } from '../src/lib/host'
import { formatCost, formatLatency, formatShare, formatValueRatio, rubricRows, scoreWidth } from '../src/lib/format'
import { RUBRIC_AXES, TASK_TYPES } from '../src/lib/types'
import { POLICY, ROSTER, makeFakeHost, type FakeHost } from './fakeHost'

/** The host installed for the current test. */
let host: FakeHost

beforeEach(() => {
  host = makeFakeHost()
  installHostClient(host.client)
})

afterEach(() => {
  cleanup()
  installHostClient(null)
})

describe('the ledger', () => {
  it('names a winner on an unblinded trial and shows SEALED on the other', async () => {
    render(<History onGoToBench={() => undefined} />)
    await screen.findByTestId('history')

    const list = screen.getByTestId('history').textContent ?? ''
    expect(list).toContain('Claude Sonnet 4.5')
    expect(list).toContain('SEALED')
    expect(list).toContain('Summarise the incident for a customer.')
  })

  it('opens a sealed trial without revealing a name', async () => {
    render(<History onGoToBench={() => undefined} />)
    await screen.findByTestId('history')

    const row = screen.getByText('Rewrite the changelog entry for release notes.')
    fireEvent.click(row)

    const detail = await screen.findByTestId('history-detail')
    expect(detail.textContent).toContain('NAMES STILL SEALED ON THIS TRIAL')
    expect(detail.textContent).not.toContain('GPT-4o')
    expect(detail.textContent).not.toContain('Claude Sonnet')
  })

  it('offers a route to the bench when the ledger is empty', async () => {
    const empty = makeFakeHost()
    empty.client.invoke = async <T,>(method: string): Promise<T> => {
      if (method === 'history_list') return { success: true, data: { trials: [], total: 0 } } as T
      return { success: true, data: {} } as T
    }
    installHostClient(empty.client)
    const goToBench = vi.fn()

    render(<History onGoToBench={goToBench} />)
    fireEvent.click(await screen.findByText('GO TO THE BENCH'))
    expect(goToBench).toHaveBeenCalled()
  })
})

describe('the routing policy', () => {
  it('shows the rank, the version and the crown count', async () => {
    render(<Policy />)
    await screen.findByTestId('policy')

    const rank = screen.getByTestId('rank-list')
    expect(rank.textContent).toContain('Claude Sonnet 4.5')
    expect(rank.textContent).toContain('GPT-4o')
    expect(screen.getByTestId('policy').textContent).toContain('V3 / 3 CROWNS')
  })

  it('renders a lock row for every task lane', async () => {
    render(<Policy />)
    await screen.findByTestId('policy')

    const locks = screen.getByTestId('locks')
    for (const task of TASK_TYPES) expect(locks.textContent).toContain(task[0].toUpperCase() + task.slice(1))
  })

  it('writes a lock through the tool and refreshes from its response', async () => {
    render(<Policy />)
    await screen.findByTestId('policy')

    const selects = screen.getByTestId('locks').querySelectorAll('select')
    fireEvent.change(selects[1], { target: { value: 'openai/gpt-4o' } })

    await waitFor(() => {
      const call = host.calls.find((entry) => entry.method === 'policy_set_lock')
      expect(call).toBeTruthy()
      expect(call?.args).toMatchObject({ task: 'draft', slot: 'fallback', model_id: 'openai/gpt-4o' })
    })
  })

  it('copies the export to the clipboard and confirms it', async () => {
    render(<Policy />)
    await screen.findByTestId('policy')

    fireEvent.click(screen.getByTestId('export-policy'))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    expect(await screen.findByText('POLICY COPIED')).toBeTruthy()
  })

  it('tells the user when there is nothing to route yet', async () => {
    const empty = makeFakeHost()
    empty.client.invoke = async <T,>(method: string): Promise<T> => {
      if (method === 'policy_get') return { success: true, data: { ...POLICY, rows: [], rank: [] } } as T
      return { success: true, data: {} } as T
    }
    installHostClient(empty.client)

    render(<Policy />)
    expect(await screen.findByText('No crowns yet')).toBeTruthy()
  })
})

describe('formatters', () => {
  it('never renders an unknown cost as zero', () => {
    expect(formatCost(null)).toBe('ANNA CREDITS')
    expect(formatCost(0)).toBe('$0.0000')
    expect(formatCost(0.0142)).toBe('$0.0142')
  })

  it('never invents a value ratio without a cost basis', () => {
    expect(formatValueRatio(null)).toBe('NO COST BASIS')
    expect(formatValueRatio(1077.33)).toBe('1,077 PT/$')
  })

  it('clamps a latency and a share to their real range', () => {
    expect(formatLatency(3900)).toBe('3.9s')
    expect(formatLatency(-5)).toBe('0.0s')
    expect(formatShare(0.824)).toBe('82%')
    expect(formatShare(4)).toBe('100%')
  })

  it('clamps a rubric score to the 0 to 5 band', () => {
    expect(scoreWidth(5)).toBe('100%')
    expect(scoreWidth(9)).toBe('100%')
    expect(scoreWidth(-2)).toBe('0%')
  })

  it('publishes five axes whose weights total one hundred', () => {
    expect(RUBRIC_AXES).toHaveLength(5)
    expect(RUBRIC_AXES.reduce((sum, axis) => sum + axis.weight, 0)).toBe(100)
    expect(rubricRows({ correctness: 4, instructionFit: 5, concision: 4, tone: 4, grounding: 3 })).toHaveLength(5)
  })
})

describe('the roster contract', () => {
  it('carries a key status and never a key', () => {
    for (const entry of ROSTER) {
      expect(typeof entry.hasKey).toBe('boolean')
      expect(Object.keys(entry).sort()).toEqual(['hasKey', 'id', 'label', 'provider', 'source'])
    }
  })
})
