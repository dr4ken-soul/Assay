/**
 * Builds the distributable archives for every platform Anna can install on.
 *
 * The plugin is plain JavaScript with zero runtime dependencies, so an archive
 * is the compiled output plus a `package.json` pointing at it. No transpiler,
 * no bundler, no native modules, and nothing platform specific, which is why
 * one build on any machine serves all five targets.
 *
 * The archive format is written by scripts/lib/zip.mjs rather than by
 * Compress-Archive or the system zip, because those emit backslash entry names
 * on Windows and the platform extracts on Linux and macOS, where
 * `dist/index.js` would not resolve.
 *
 * The `binary_artifacts` entries in executa.json set `entrypoint:
 * dist/index.js`, so the platform resolves that path inside the archive.
 *
 * Usage: node scripts/build-artifacts.mjs [outDir]
 */

import { readFileSync, readdirSync, statSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildZip } from './lib/zip.mjs'

/** The executa root. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where the archives land. Matches the paths declared in executa.json. */
const OUT = process.argv[2] ?? join(ROOT, 'build')

/** The platforms declared in executa.json, in the same order. */
const PLATFORMS = [
  'windows-x86_64',
  'darwin-arm64',
  'darwin-x86_64',
  'linux-x86_64',
  'linux-arm64',
]

/**
 * Lists every file under a directory, recursively.
 * @param dir The directory to walk.
 * @returns Absolute file paths.
 */
function walk(dir) {
  const found = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else found.push(full)
  }
  return found
}

if (!readdirSync(ROOT).includes('dist')) {
  process.stderr.write('dist/ is missing, run: npm run build\n')
  process.exit(1)
}

/** The compiled plugin manifest, the source of the version. */
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'))

/** The minimal package.json that ships inside every archive. */
const archivePackageJson = {
  name: 'assay-core',
  version: manifest.version,
  private: true,
  type: 'module',
  main: 'dist/index.js',
  bin: { 'assay-core': 'dist/index.js' },
  engines: { node: '>=18.17' },
  license: 'MIT',
}

const files = [
  ...walk(join(ROOT, 'dist')).map((full) => ({
    // Always forward slashes, whatever the builder's platform separator is.
    path: relative(ROOT, full).split(sep).join('/'),
    data: readFileSync(full),
  })),
  {
    path: 'package.json',
    data: Buffer.from(`${JSON.stringify(archivePackageJson, null, 2)}\n`, 'utf8'),
  },
  {
    path: 'executa.json',
    data: readFileSync(join(ROOT, 'executa.json')),
  },
]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const archive = buildZip(files)

for (const platform of PLATFORMS) {
  const zip = join(OUT, `assay-core-${platform}.zip`)
  writeFileSync(zip, archive)
  process.stdout.write(`  ${relative(ROOT, zip)}  ${archive.length} bytes\n`)
}

process.stdout.write(`\nbuilt ${PLATFORMS.length} archives into ${relative(ROOT, OUT)}\n`)
process.stdout.write(`${files.length} files each, forward-slash entry names, identical bytes on every platform\n`)
process.stdout.write('next: anna-app executa publish --bump patch --profile binary\n')
