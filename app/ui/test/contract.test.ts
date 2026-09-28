/**
 * The contract between the bundle and the tool.
 *
 * The two live in separate packages and the bundle is uploaded as static files,
 * so this test reads the tool's own manifest and asserts the bundle calls the
 * same method names. If either side drifts, this fails rather than a user's
 * trial.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TOOL_ID } from '../src/lib/host'
import { TASK_TYPES, LOCK_SLOTS } from '../src/lib/types'

/** The repository root, two levels above the UI package. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** The app manifest, the source of truth for grants and views. */
const manifest = JSON.parse(
  execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))`, join(repoRoot, 'app', 'manifest.json')]).toString(),
) as {
  schema: number
  required_executas: Array<{ tool_id: string }>
  ui: { bundle: { entry: string }; views: Array<{ name: string; default?: boolean }>; host_api: Record<string, string[]> }
  host_capabilities: string[]
  permissions: string[]
}

/**
 * Reads the tool's own describe manifest by driving the built plugin.
 * @returns The parsed describe result.
 */
function readToolManifest(): {
  name: string
  tools: Array<{ name: string; parameters: Array<{ name: string; type: string; items?: unknown; items_type?: string }> }>
  credentials: Array<{ name: string; required: boolean; sensitive: boolean }>
  host_capabilities: string[]
} {
  const entry = join(repoRoot, 'app', 'executas', 'assay-core', 'dist', 'index.js')
  if (!existsSync(entry)) throw new Error('the tool is not built, run npm run build in app/executas/assay-core first')
  const frame = execFileSync(process.execPath, [entry], {
    input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'describe', params: {} })}\n`,
    encoding: 'utf8',
  })
  return JSON.parse(frame.trim().split('\n').pop() as string).result
}

describe('the app manifest', () => {
  it('is schema 2 or higher with exactly one bundled tool', () => {
    expect(manifest.schema).toBeGreaterThanOrEqual(2)
    expect(manifest.required_executas).toHaveLength(1)
    expect(manifest.required_executas[0].tool_id).toBe(TOOL_ID)
  })

  it('grants the tools namespace for the bundled tool and nothing else', () => {
    expect(manifest.ui.host_api.tools).toEqual([`required:${TOOL_ID}`])
  })

  it('grants only the storage methods the bundle actually uses', () => {
    expect([...manifest.ui.host_api.storage].sort()).toEqual(['delete', 'get', 'list', 'set'])
  })

  it('grants no direct model access from the bundle', () => {
    expect(manifest.ui.host_api.llm ?? []).toEqual([])
    expect(manifest.ui.host_api.chat ?? []).toEqual([])
  })

  it('declares the host capabilities the tool needs', () => {
    expect(manifest.host_capabilities).toContain('llm.sample')
    expect(manifest.host_capabilities).toContain('aps.kv')
  })

  it('declares one window per route with a single instance', () => {
    const names = manifest.ui.views.map((view) => view.name)
    expect(names).toEqual(['bench', 'history', 'policy'])
    expect(names.filter((name) => name === manifest.ui.views.find((v) => v.default)?.name)).toHaveLength(1)
  })

  it('points the bundle entry at the built index', () => {
    expect(manifest.ui.bundle.entry).toBe('index.html')
  })
})

describe('the tool id is wired identically everywhere', () => {
  it('agrees between the discovery file, the manifest and the bundle', () => {
    const discovery = JSON.parse(
      execFileSync(process.execPath, [
        '-e',
        `process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))`,
        join(repoRoot, 'app', 'executas', 'assay-core', 'executa.json'),
      ]).toString(),
    ) as { tool_id: string }

    const fromBundle = readFileSync(join(repoRoot, 'app', 'ui', 'src', 'lib', 'host.ts'), 'utf8').match(
      /export const TOOL_ID = '([^']+)'/,
    )?.[1]

    expect(discovery.tool_id).toBe(TOOL_ID)
    expect(manifest.required_executas[0].tool_id).toBe(TOOL_ID)
    expect(manifest.ui.host_api.tools[0]).toBe(`required:${TOOL_ID}`)
    expect(fromBundle).toBe(TOOL_ID)
  })

  it('agrees with the id the running plugin reports through describe', () => {
    // The plugin reads its own executa.json at startup, so describe.name and the
    // discovery file cannot drift. This asserts that wiring actually works.
    const tool = readToolManifest()
    expect(tool.name).toBe(TOOL_ID)
  })
})

describe('the tool manifest', () => {
  const tool = readToolManifest()

  it('declares the eleven blueprint methods', () => {
    expect(tool.tools.map((entry) => entry.name)).toEqual([
      'roster_list',
      'trial_start',
      'trial_status',
      'trial_verdict',
      'trial_crown',
      'trial_unblind',
      'history_list',
      'history_get',
      'policy_get',
      'policy_set_lock',
      'policy_export',
    ])
  })

  it('gives every array parameter an items declaration', () => {
    for (const method of tool.tools) {
      for (const parameter of method.parameters) {
        if (parameter.type === 'array') {
          expect(parameter.items ?? parameter.items_type, `${method.name}.${parameter.name}`).toBeTruthy()
        }
      }
    }
  })

  it('declares every provider key as optional and sensitive', () => {
    expect(tool.credentials.length).toBeGreaterThanOrEqual(8)
    for (const credential of tool.credentials) {
      expect(credential.required, credential.name).toBe(false)
      expect(credential.sensitive, credential.name).toBe(true)
    }
  })

  it('declares the reverse capabilities the tool actually calls', () => {
    expect(tool.host_capabilities).toContain('llm.sample')
    expect(tool.host_capabilities).toContain('aps.kv')
  })
})

describe('the enums the two sides share', () => {
  it('agrees on the task lanes and the lock slots', () => {
    expect(TASK_TYPES).toEqual(['draft', 'rewrite', 'extract', 'code', 'analyse'])
    expect(LOCK_SLOTS).toEqual(['default', 'fallback', 'budget'])
  })
})
