/**
 * Fetches the ad-hoc Mach-O signer used when a macOS binary is built on a
 * machine that is not a Mac.
 *
 * Injecting the SEA blob rewrites the Mach-O load commands and drops the code
 * signature Node ships with. Linux and Windows do not care, but the arm64
 * kernel on Apple Silicon refuses to start an unsigned executable, so a
 * `darwin-arm64` artifact that skipped this step would fail on exactly the
 * machines it claims to support.
 *
 * `rcodesign` is the Apple codesigning implementation from the
 * apple-platform-rs project. It writes the same ad-hoc signature that
 * `codesign --sign -` writes, and it runs on Windows and Linux. On a real Mac
 * the build uses the system `codesign` and never calls this script.
 *
 * Usage:
 *   node scripts/fetch-rcodesign.mjs        print the signer's path
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The project root, one level above this script. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The pinned signer release. */
const VERSION = '0.29.0'

/** The release's asset name, per host platform this build can run on. */
const ASSETS = {
  'win32-x64': {
    file: `apple-codesign-${VERSION}-x86_64-pc-windows-msvc.zip`,
    kind: 'zip',
    bin: join(`apple-codesign-${VERSION}-x86_64-pc-windows-msvc`, 'rcodesign.exe'),
  },
  'linux-x64': {
    file: `apple-codesign-${VERSION}-x86_64-unknown-linux-musl.tar.gz`,
    kind: 'tar.gz',
    bin: join(`apple-codesign-${VERSION}-x86_64-unknown-linux-musl`, 'rcodesign'),
  },
  'linux-arm64': {
    file: `apple-codesign-${VERSION}-aarch64-unknown-linux-musl.tar.gz`,
    kind: 'tar.gz',
    bin: join(`apple-codesign-${VERSION}-aarch64-unknown-linux-musl`, 'rcodesign'),
  },
}

/**
 * Runs a command and returns its stdout.
 * @param {string} cmd The program.
 * @param {string[]} args The arguments.
 * @returns {string} The output.
 */
function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
}

/**
 * Downloads a URL to a file, resuming or retrying once.
 * @param {string} url The source.
 * @param {string} path The destination.
 * @returns {void}
 */
function download(url, path) {
  rmSync(path, { force: true })
  run('curl', ['-sSL', '--fail', '--retry', '5', '--retry-delay', '2', '--max-time', '600', '-o', path, url])
  if (!existsSync(path) || statSync(path).size === 0) throw new Error(`download produced no file: ${url}`)
}

/**
 * Resolves the signer, downloading and verifying it on first use.
 * @returns {string} The absolute path of the `rcodesign` executable.
 */
export function ensureRcodesign() {
  const spec = ASSETS[`${process.platform}-${process.arch}`]
  if (spec === undefined) {
    throw new Error(`no rcodesign build for ${process.platform}-${process.arch}; build the macOS artifacts on a Mac instead`)
  }

  const cache = join(ROOT, '.sea', 'cache', `rcodesign-${VERSION}`)
  const binary = join(cache, process.platform === 'win32' ? 'rcodesign.exe' : 'rcodesign')
  if (existsSync(binary) && statSync(binary).size > 0) return binary

  mkdirSync(cache, { recursive: true })
  const base = `https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign/${VERSION}/${spec.file}`
  const archive = join(cache, spec.file)
  download(base, archive)

  const checksumPath = `${archive}.sha256`
  download(`${base}.sha256`, checksumPath)
  const expected = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0].toLowerCase()
  const actual = createHash('sha256').update(readFileSync(archive)).digest('hex')
  rmSync(checksumPath, { force: true })
  if (!/^[0-9a-f]{64}$/.test(expected) || expected !== actual) {
    rmSync(archive, { force: true })
    throw new Error(`rcodesign checksum mismatch: expected ${expected}, got ${actual}`)
  }

  const unpacked = join(cache, 'unpacked')
  rmSync(unpacked, { recursive: true, force: true })
  mkdirSync(unpacked, { recursive: true })
  if (spec.kind === 'zip') {
    run('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${unpacked}' -Force`,
    ])
  } else {
    run('tar', ['-xzf', archive, '-C', unpacked])
  }

  const extracted = join(unpacked, spec.bin)
  if (!existsSync(extracted)) throw new Error(`rcodesign not found after unpacking at ${extracted}`)
  renameSync(extracted, binary)
  rmSync(unpacked, { recursive: true, force: true })
  rmSync(archive, { force: true })
  return binary
}

// Running the script directly prints the path, which keeps it usable from a
// shell while the build imports the function above.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(`${ensureRcodesign()}\n`)
}
