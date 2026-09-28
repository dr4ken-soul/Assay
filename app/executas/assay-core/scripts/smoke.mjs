/**
 * Protocol smoke test.
 *
 * Spawns the built plugin, drives the full v2 handshake and asserts that
 * `describe` and `health` answer on stdout with protocol frames only. Run it in
 * CI so a regression in the framing fails the build rather than the app.
 *
 * Usage: node scripts/smoke.mjs
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const entry = join(here, '..', 'dist', 'index.js')

/**
 * Spawns the plugin and collects its stdout frames.
 * @returns The child process and a frame reader.
 */
function spawnPlugin() {
  const child = spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'pipe'] })
  const frames = []
  let buffer = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) frames.push(JSON.parse(line))
    }
  })
  return { child, frames }
}

/**
 * Waits until a frame with the given id arrives.
 * @param frames The frame list, which grows as the plugin writes.
 * @param id The request id to wait for.
 * @returns The matching frame.
 */
async function waitFor(frames, id) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const found = frames.find((frame) => frame.id === id)
    if (found) return found
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`no frame for id ${id}`)
}

const { child, frames } = spawnPlugin()

const send = (frame) => child.stdin.write(`${JSON.stringify(frame)}\n`)

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2.0', host_capabilities: { 'llm.sample': true } } })
const init = await waitFor(frames, 1)
if (init.result?.protocolVersion !== '2.0') throw new Error('v2 handshake did not echo the protocol version')
if (!init.result?.client_capabilities?.sampling) throw new Error('plugin did not advertise the sampling capability')

send({ jsonrpc: '2.0', id: 2, method: 'describe', params: {} })
const described = await waitFor(frames, 2)
const manifest = described.result
// The platform mints the tool id and the plugin's describe name must equal it.
// The plugin reads executa.json at startup, so this also proves that wiring.
const declaredId = JSON.parse(readFileSync(join(here, '..', 'executa.json'), 'utf8')).tool_id
if (manifest.name !== declaredId) {
  throw new Error(`describe.name is ${manifest.name}, executa.json declares ${declaredId}`)
}
if (manifest.display_name !== 'Assay') throw new Error('display_name was lost')
if (!Array.isArray(manifest.tools) || manifest.tools.length !== 11) throw new Error(`expected 11 tools, got ${manifest.tools?.length}`)
if (!manifest.credentials?.length) throw new Error('the credential schema is missing, BYOK would silently no-op')
if (!manifest.host_capabilities?.includes('llm.sample')) throw new Error('llm.sample is not declared')
if (!manifest.host_capabilities?.includes('aps.kv')) throw new Error('aps.kv is not declared')
for (const tool of manifest.tools) {
  for (const parameter of tool.parameters ?? []) {
    if (parameter.type === 'array' && !parameter.items && !parameter.items_type) {
      throw new Error(`${tool.name}.${parameter.name} is an array with no items, the model will serialise it as a string`)
    }
  }
}

send({ jsonrpc: '2.0', id: 3, method: 'health', params: {} })
const health = await waitFor(frames, 3)
if (health.result?.status !== 'healthy') throw new Error('health did not report healthy')

send({ jsonrpc: '2.0', id: 4, method: 'not_a_method', params: {} })
const unknown = await waitFor(frames, 4)
if (unknown.error?.code !== -32601) throw new Error('an unknown method must answer -32601 so the host can fall back to v1')

send({
  jsonrpc: '2.0',
  id: 5,
  method: 'invoke',
  params: { tool: 'roster_list', arguments: {}, invoke_id: 'inv_1', context: { credentials: { OPENAI_API_KEY: 'sk-not-a-real-key' } } },
})
const roster = await waitFor(frames, 5)
if (roster.result?.success !== true) throw new Error('roster_list did not succeed')
if (!roster.result.data.roster.some((entry) => entry.id === 'openai/gpt-4o')) throw new Error('an injected key did not surface its models')
if (roster.result.data.roster.some((entry) => Object.keys(entry).includes('apiKey'))) throw new Error('the roster leaked credential material')
const serialised = JSON.stringify(roster.result)
if (serialised.includes('sk-not-a-real-key')) throw new Error('the response echoed a credential value')

send({
  jsonrpc: '2.0',
  id: 6,
  method: 'invoke',
  params: { tool: 'trial_start', arguments: { workload: 'Summarise this incident in three lines.', roster_ids: ['openai/gpt-4o', 'openai/gpt-4o'] } },
})
const single = await waitFor(frames, 6)
if (single.result?.success !== false) throw new Error('a one model roster should have been refused')
if (!String(single.result.error).includes('at least two models')) throw new Error('the refusal did not explain itself')

send({
  jsonrpc: '2.0',
  id: 7,
  method: 'invoke',
  params: { tool: 'trial_start', arguments: { workload: 'no', roster_ids: ['openai/gpt-4o', 'openai/gpt-4o-mini'] } },
})
const stubby = await waitFor(frames, 7)
if (stubby.result?.success !== false) throw new Error('a two character workload should have been refused')
if (!String(stubby.result.error).includes('at least 8 characters')) throw new Error('the refusal did not explain itself')

send({ jsonrpc: '2.0', id: 8, method: 'invoke', params: { tool: 'not_a_tool', arguments: {} } })
const badTool = await waitFor(frames, 8)
if (badTool.error?.code !== -32601) throw new Error('an unknown tool must answer -32601')

child.stdin.end()

process.stdout.write(`smoke ok, ${manifest.tools.length} tools, roster ${roster.result.data.roster.length} entries\n`)
