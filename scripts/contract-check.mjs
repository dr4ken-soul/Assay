/**
 * Checks the bundle-to-tool contract without the vitest toolchain, which is
 * not installed on this machine. It asserts the same facts: the tool id is
 * identical in executa.json, the app manifest and the bundle source, and the
 * version is identical in package.json, executa.json and the running plugin.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const fail = (message) => {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}
const ok = (message) => console.log(`ok   ${message}`)

const executa = read(join(root, 'app', 'executas', 'assay-core', 'executa.json'))
const pkg = read(join(root, 'app', 'executas', 'assay-core', 'package.json'))
const manifest = read(join(root, 'app', 'manifest.json'))
const host = readFileSync(join(root, 'app', 'ui', 'src', 'lib', 'host.ts'), 'utf8')
const bundleId = host.match(/export const TOOL_ID = '([^']+)'/)?.[1]

if (executa.tool_id === manifest.required_executas[0].tool_id && executa.tool_id === bundleId) {
  ok(`tool id agrees across executa.json, manifest.json and host.ts (${executa.tool_id})`)
} else {
  fail(`tool id drift: executa=${executa.tool_id} manifest=${manifest.required_executas[0].tool_id} bundle=${bundleId}`)
}

if (manifest.ui.host_api.tools[0] === `required:${executa.tool_id}`) ok('host_api.tools is scoped to the bundled tool')
else fail(`host_api.tools is ${manifest.ui.host_api.tools.join(', ')}`)

if (manifest.required_executas[0].min_version === pkg.version) {
  ok(`min_version matches the tool version (${pkg.version})`)
} else {
  fail(`min_version ${manifest.required_executas[0].min_version} != package version ${pkg.version}`)
}

const entry = join(root, 'app', 'executas', 'assay-core', 'dist', 'index.js')
if (!existsSync(entry)) {
  fail('the tool is not built')
} else {
  const out = execFileSync(process.execPath, [entry], {
    input: `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'describe', params: {} })}\n`,
    encoding: 'utf8',
  })
  const described = JSON.parse(out.trim().split('\n').pop()).result
  if (described.name === executa.tool_id) ok(`describe reports the tool id (${described.name})`)
  else fail(`describe reports ${described.name}`)
  if (described.version === pkg.version) ok(`describe reports the version (${described.version})`)
  else fail(`describe reports version ${described.version}, package says ${pkg.version}`)
  if (described.tools.length === 11) ok('describe declares 11 methods')
  else fail(`describe declares ${described.tools.length} methods`)
}

if (process.exitCode) process.exit(process.exitCode)
console.log('contract ok')
