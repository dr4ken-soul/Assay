/**
 * The blind check.
 *
 * Two passes over the product's core promise.
 *
 *   1. A static scan of the bundle source for a model name or a provider
 *      handle baked into a component. A name in the source is a name that can
 *      reach the DOM by accident.
 *   2. The blind DOM suite, which renders the running and verdict states and
 *      asserts that no roster name appears in the document.
 *
 * Usage: node scripts/blind-check.mjs
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Identities that must never be hardcoded in a component. */
const FORBIDDEN = [
  'gpt-4o',
  'gpt-4.1',
  'gpt-5',
  'claude-sonnet',
  'claude-opus',
  'claude-haiku',
  'gemini-2',
  'grok-4',
  'grok-3',
  'llama-3',
  'deepseek-chat',
  'mistral-large',
  'mistral/small',
  'openrouter/auto',
]

/** Provider handles, checked as whole words so `xmlLang` does not match `xml`. */
const PROVIDERS = ['openai', 'anthropic', 'xai', 'mistral', 'groq', 'deepseek', 'openrouter', 'google']

/** Files allowed to name a model, the data and the host layer that own them. */
const ALLOWED = ['src/lib/types.ts', 'src/lib/host.ts', 'lib/']

/**
 * Lists every TypeScript and TSX file under the source tree.
 * @param dir The directory to walk.
 * @returns Absolute file paths.
 */
function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...walk(full))
    } else if (['.ts', '.tsx'].includes(extname(full))) {
      found.push(full)
    }
  }
  return found
}

/**
 * Runs the static pass.
 * @returns The offending files, empty when the scan is clean.
 */
function scanSource() {
  const offences = []
  for (const file of walk(join(packageRoot, 'src'))) {
    const rel = relative(packageRoot, file).replace(/\\/g, '/')
    if (ALLOWED.some((prefix) => rel.startsWith(prefix))) continue
    const source = readFileSync(file, 'utf8').toLowerCase()
    for (const term of FORBIDDEN) {
      if (source.includes(term)) offences.push(`${rel} contains the model name "${term}"`)
    }
    for (const provider of PROVIDERS) {
      const pattern = new RegExp(`(^|[^a-z])${provider}([^a-z]|$)`, 'g')
      if (pattern.test(source)) offences.push(`${rel} names the provider "${provider}"`)
    }
  }
  return offences
}

const offences = scanSource()

if (offences.length > 0) {
  process.stderr.write(`blind check failed, a model identity reached the component layer:\n`)
  for (const offence of offences) process.stderr.write(`  ${offence}\n`)
  process.exit(1)
}

process.stdout.write('static pass clean, no model name or provider handle in the component layer\n')

execFileSync(process.execPath, [join(packageRoot, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'test/blind.test.tsx'], {
  cwd: packageRoot,
  stdio: 'inherit',
})

process.stdout.write('blind check passed, the running and verdict states carry no model name\n')
