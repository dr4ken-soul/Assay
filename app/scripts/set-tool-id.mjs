/**
 * Apply or reset the minted Executa id across the app.
 *
 * The platform mints a tool id and the SAME string has to appear in four
 * places. Forgetting any one of them produces a Stopped card or a silent
 * `tools.invoke` timeout, with no error at build time:
 *
 *   1. app/executas/assay-core/executa.json   tool_id, read by the CLI and by
 *                                             the plugin itself at startup
 *   2. app/manifest.json                     required_executas[0].tool_id
 *   3. app/manifest.json                     ui.host_api.tools[0]
 *   4. app/ui/src/lib/host.ts                the TOOL_ID constant
 *
 * (4) is checked against (1) by app/ui/test/contract.test.ts, so a drift
 * fails the suite rather than a user's trial.
 *
 * Usage:
 *   node scripts/set-tool-id.mjs status
 *   node scripts/set-tool-id.mjs apply --tool tool-yourhandle-assay-abcd1234
 *   node scripts/set-tool-id.mjs reset
 *
 * Idempotent. Refuses to overwrite a real id without --force.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repository root, two levels above this script. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The placeholder that ships in the repository. */
const PLACEHOLDER = 'tool-dev-assay'

/**
 * Matches a minted Anna tool id, for example `tool-dr4ken-assay-a1b2c3`.
 * The platform mints `{kind}-{handle}-{slug}-{uniq}`.
 */
const MINTED = /^tool-[A-Za-z0-9][A-Za-z0-9-]*$/

/**
 * One syntactic position that holds a tool id.
 *
 * Each anchor carries its own rewrite, because the four positions are not
 * written the same way. `pattern` must expose the id as capture group 1 and
 * must not swallow a surrounding quote into a different group, or the rewrite
 * produces malformed JSON.
 *
 * @param path Path relative to the repository root.
 * @param pattern A regex whose capture group 1 is the id.
 * @param label What this position is, for the status output.
 * @param rewrite Rebuilds the match from its capture groups and the new id.
 */
const anchors = [
  {
    path: 'executas/assay-core/executa.json',
    label: 'executa.json tool_id',
    pattern: /("tool_id"\s*:\s*")(tool-[A-Za-z0-9][A-Za-z0-9-]*)(")/,
    rewrite: (head, tail, next) => `${head}${next}${tail}`,
  },
  {
    path: 'manifest.json',
    label: 'manifest.json required_executas[0].tool_id',
    pattern: /("required_executas"\s*:\s*\[\s*\{\s*"tool_id"\s*:\s*")(tool-[A-Za-z0-9][A-Za-z0-9-]*)(")/,
    rewrite: (head, tail, next) => `${head}${next}${tail}`,
  },
  {
    path: 'manifest.json',
    label: 'manifest.json ui.host_api.tools[0]',
    // The element carries a `required:` prefix and its own quotes, so both are
    // written back explicitly. The trailing quote is consumed by the pattern
    // and must not be re-emitted, or the array element doubles up.
    pattern: /("tools"\s*:\s*\[\s*)(?:"|')?(?:required:)?(tool-[A-Za-z0-9][A-Za-z0-9-]*)((?:"|')?)/,
    rewrite: (head, _tail, next) => `${head}"required:${next}"`,
  },
  {
    path: 'ui/src/lib/host.ts',
    label: 'ui/src/lib/host.ts TOOL_ID',
    pattern: /(export const TOOL_ID = ')(tool-[A-Za-z0-9][A-Za-z0-9-]*)(')/,
    rewrite: (head, tail, next) => `${head}${next}${tail}`,
  },
]

/**
 * Reads a file from the repository root.
 * @param rel The path relative to the root.
 * @returns The file contents.
 */
function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/**
 * Writes a file under the repository root, preserving LF endings.
 * @param rel The path relative to the root.
 * @param text The new contents.
 * @returns Nothing.
 */
function write(rel, text) {
  writeFileSync(join(ROOT, rel), text, 'utf8')
}

/**
 * Every tool id currently wired into the repository.
 * @returns A map of anchor label to the id found there.
 */
function collect() {
  const found = new Map()
  for (const anchor of anchors) {
    const match = anchor.pattern.exec(read(anchor.path))
    if (match) found.set(anchor.label, match[2])
  }
  return found
}

/**
 * Prints the current wiring.
 * @returns Nothing.
 */
function status() {
  const found = collect()
  const unique = [...new Set(found.values())]
  if (unique.length === 0) {
    process.stdout.write('no tool id found in any anchor, check the file layout\n')
    return
  }
  for (const [label, id] of found) {
    const marker = id === PLACEHOLDER ? ' (placeholder)' : ' (MINTED)'
    process.stdout.write(`  ${id}${marker.padEnd(marker.length - 12)}  ${label}\n`)
  }
  if (unique.length > 1) {
    process.stdout.write(`\nINCONSISTENT. Found ${unique.length} different ids. Run reset, then apply.\n`)
    return
  }
  process.stdout.write(unique[0] === PLACEHOLDER ? '\nplaceholder, not yet minted\n' : '\nminted and wired\n')
}

/**
 * Writes one id into every anchor.
 * @param id The id to write.
 * @returns Nothing.
 */
function apply(id) {
  if (!MINTED.test(id)) {
    process.stderr.write(`refusing: ${id} does not look like a minted tool id\n`)
    process.exit(1)
  }
  const existing = [...new Set(collect().values())]
  const alreadyReal = existing.find((value) => value !== PLACEHOLDER)
  if (alreadyReal && alreadyReal !== id) {
    process.stderr.write(`refusing: already wired to ${alreadyReal}. Run reset first.\n`)
    process.exit(1)
  }

  let touched = 0
  const unmatched = []
  for (const anchor of anchors) {
    const before = read(anchor.path)
    if (!anchor.pattern.test(before)) {
      unmatched.push(anchor.label)
      continue
    }
    const after = before.replace(
      anchor.pattern,
      (_match, head, _id, tail) => anchor.rewrite(head, tail ?? '', id),
    )
    if (after !== before) {
      write(anchor.path, after)
      touched += 1
      process.stdout.write(`  updated  ${anchor.path}  (${anchor.label})\n`)
    }
  }
  process.stdout.write(
    touched === 0
      ? `already wired to ${id}, no changes\n`
      : `\nwired ${id} into ${touched} of ${anchors.length} anchors\n`,
  )
  if (unmatched.length > 0) {
    process.stderr.write(
      `WARNING: ${unmatched.length} anchor(s) did not match, check the file layout: ${unmatched.join(', ')}\n`,
    )
  }
}

/**
 * Puts the placeholder back everywhere, so the repository stays publishable
 * and diffable.
 * @returns Nothing.
 */
function reset() {
  for (const anchor of anchors) {
    const before = read(anchor.path)
    const after = before.replace(
      anchor.pattern,
      (_match, head, _id, tail) => anchor.rewrite(head, tail ?? '', PLACEHOLDER),
    )
    if (after !== before) {
      write(anchor.path, after)
      process.stdout.write(`  reset  ${anchor.path}\n`)
    }
  }
  process.stdout.write(`\nreset to ${PLACEHOLDER}\n`)
}

const [command, ...rest] = process.argv.slice(2)

if (command === 'status') {
  status()
} else if (command === 'apply') {
  const tool = rest[rest.indexOf('--tool') + 1]
  if (!tool || tool.startsWith('--')) {
    process.stderr.write('usage: apply --tool tool-<handle>-assay-<uniq>\n')
    process.exit(1)
  }
  apply(tool)
} else if (command === 'reset') {
  reset()
} else {
  process.stdout.write(
    'set-tool-id, keeps the minted Executa id consistent across the app\n\n' +
      '  status   print what is currently wired\n' +
      '  apply    wire a minted id into every anchor,  --tool <minted-id>\n' +
      '  reset    put the placeholder back everywhere\n\n' +
      'mint your id at https://anna.partners/executa\n',
  )
}
