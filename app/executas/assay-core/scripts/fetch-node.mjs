/**
 * Downloads one file, resuming until it is whole.
 *
 * The Node runtime is a forty megabyte file and the network on this machine
 * is slow and resets part way through a large transfer. A download that
 * starts again from zero never finishes, so the transfer is resumed from
 * wherever it stopped, with the checksum deciding when it is done.
 *
 * Usage:
 *   node scripts/fetch-node.mjs <platform> <expected-sha256>
 *
 * The platform is the Node distribution name, for example `linux-x64`.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The project root, one level above this script. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The Node release being embedded. */
const NODE_VERSION = 'v24.22.1'

/** Where the runtime is cached between runs. */
const CACHE = join(ROOT, '.sea', 'cache')

const [platform, sha256] = process.argv.slice(2)
if (!platform || !sha256) {
  process.stderr.write('usage: node scripts/fetch-node.mjs <platform> <sha256>\n')
  process.exit(1)
}

const isWindows = platform === 'win-x64'
const filename = `node-${NODE_VERSION}-${platform}.${isWindows ? 'zip' : 'tar.gz'}`
const target = join(CACHE, filename)
mkdirSync(CACHE, { recursive: true })

const urls = [
  `https://nodejs.org/dist/${NODE_VERSION}/${filename}`,
  `https://npmmirror.com/mirrors/node/${NODE_VERSION}/${filename}`,
  `https://cdn.npmmirror.com/binaries/node/${NODE_VERSION}/${filename}`,
]

/**
 * Runs curl and returns its output whatever the exit status.
 *
 * A transfer that times out part way through is not a failure, it is a
 * transfer that has to be resumed, so the partial output is kept rather
 * than thrown away with the error.
 * @param {string[]} args The curl arguments.
 * @returns {string} The output.
 */
function curl(args) {
  try {
    return execFileSync('curl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    if (process.env.FETCH_DEBUG) {
      process.stdout.write(`  curl stderr: ${String(error.stderr).trim().slice(0, 300)}\n`)
      process.stdout.write(`  curl args: ${args.join(' ')}\n`)
    }
    return typeof error.stdout === 'string' ? error.stdout : ''
  }
}

/**
 * The checksum of a file on disk.
 * @param {string} path The file.
 * @returns {string} The lowercase hex digest.
 */
function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

for (let attempt = 1; attempt <= 400; attempt += 1) {
  let before = existsSync(target) ? statSync(target).size : 0
  if (before > 0 && digest(target) === sha256) {
    process.stdout.write(`${filename} complete, ${(before / 1024 / 1024).toFixed(1)} MB\n`)
    process.exit(0)
  }
  // A file too small to be a partial runtime is the body of an error page.
  // It is removed, because asking a server to resume from it is a request
  // for a range that does not exist, and the answer to that is a 404 that
  // looks exactly like the mirror being broken.
  if (before > 0 && before <= 1024) {
    rmSync(target, { force: true })
    before = 0
  }

  const url = urls[(attempt - 1) % urls.length]
  const args = ['-sSL', '--max-time', '120', '--connect-timeout', '30']
  if (before > 1024) args.push('-C', '-')
  args.push('-o', target, '-w', '%{http_code}', url)
  const status = curl(args).trim()

  const after = existsSync(target) ? statSync(target).size : 0
  if (after > 0 && digest(target) === sha256) {
    process.stdout.write(`${filename} complete, ${(after / 1024 / 1024).toFixed(1)} MB\n`)
    process.exit(0)
  }

  if (after > 0 && after <= before) {
    // The server sent nothing new, so what is on disk is not a partial
    // runtime and is discarded rather than resumed from. A file that grew
    // is a partial transfer and is kept for the next attempt.
    rmSync(target, { force: true })
  }
  process.stdout.write(`${filename} ${(after / 1024 / 1024).toFixed(1)} MB, status ${status}\n`)
}

process.stderr.write(`could not download ${filename}\n`)
process.exit(1)
