/**
 * Builds one self-contained executable per platform using Node single
 * executable applications.
 *
 * The Anna Cloud Agent runs on Linux with no language runtime installed, and
 * an app's bundled tool is spawned as a plain process. A `binary`
 * distribution therefore has to be a real self-contained executable, not a
 * script that expects an interpreter to be found for it. A zip of JavaScript
 * plus a shebang satisfies neither: the host has nothing to run it with.
 *
 * SEA embeds the script and the Node runtime into one file, so the result
 * needs nothing on the machine but the file itself.
 *
 * The one thing SEA cannot do is read files from beside the executable, and
 * this plugin reads two: `executa.json` for the tool id and `package.json`
 * for the version. Both are baked in at build time instead, which is also
 * what the platform wants, since the tool id is minted server side and must
 * not drift from the frozen version.
 *
 * Usage:
 *   node scripts/build-binaries.mjs            build every platform
 *   node scripts/build-binaries.mjs windows-x86_64   build one
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync, statSync, chmodSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildZip } from './lib/zip.mjs'
import { buildTarGz } from './lib/tar.mjs'
import { signMachO } from './lib/sign-macho.mjs'

/** The project root, one level above this script. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where the finished archives land. */
const OUT = join(ROOT, 'build')

/** Where the intermediate build tree lands. */
const WORK = join(ROOT, '.sea')

/**
 * The Node release the binaries are built against.
 *
 * Pinned rather than taken from the local runtime, because the runtime that
 * is injected into each executable is downloaded for the target platform, and
 * a version that only exists on this machine has no download for the others.
 */
const NODE_VERSION = 'v24.22.1'

/**
 * The platforms the Anna agents run on.
 *
 * The keys are the canonical `<os>-<arch>` names the platform accepts, and
 * they are the same keys the listing shows as runtime environments.
 *
 * `node` is the name Node uses for that platform in its own distribution.
 * The archive it publishes differs by platform, Windows gets a zip of the
 * whole tree and the others get a tarball of the same tree, so the download
 * and the unpack are both per platform.
 */
const PLATFORMS = {
  'windows-x86_64': { node: 'win-x64', archive: 'zip', exe: 'assay-core.exe' },
  'darwin-x86_64': { node: 'darwin-x64', archive: 'tar.gz', exe: 'assay-core' },
  'darwin-arm64': { node: 'darwin-arm64', archive: 'tar.gz', exe: 'assay-core' },
  'linux-x86_64': { node: 'linux-x64', archive: 'tar.gz', exe: 'assay-core' },
  'linux-arm64': { node: 'linux-arm64', archive: 'tar.gz', exe: 'assay-core' },
}

/**
 * Runs a command, inheriting the standard streams.
 * @param {string} cmd The program to run.
 * @param {string[]} args The arguments.
 * @returns {string} The command's stdout.
 */
function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 })
}

/**
 * Reads the two values the plugin used to read from disk.
 *
 * The tool id is the server-minted identity and the version is the plugin
 * version, and both are fixed at build time for a binary, so the baked values
 * and the files on disk must never disagree.
 * @returns {{toolId: string, version: string}} The baked identity.
 */
function readIdentity() {
  const executa = JSON.parse(readFileSync(join(ROOT, 'executa.json'), 'utf8'))
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  if (typeof executa.tool_id !== 'string' || !executa.tool_id.startsWith('tool-')) {
    throw new Error(`executa.json has no minted tool_id, got ${JSON.stringify(executa.tool_id)}`)
  }
  if (typeof pkg.version !== 'string' || pkg.version.length === 0) {
    throw new Error('package.json has no version')
  }
  return { toolId: executa.tool_id, version: pkg.version }
}

/**
 * The published checksums for the Node release being embedded.
 *
 * The runtime is downloaded from a mirror, and a mirror can serve an error
 * page under the right URL. The checksum is what makes the download
 * trustworthy, so it is read from the release itself rather than copied
 * into the script.
 * @returns {Record<string, string>} The checksum for each release file.
 */
function readChecksums() {
  const path = join(WORK, 'SHASUMS256.txt')
  if (!existsSync(path) || statSync(path).size === 0) {
    const urls = [
      `https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt`,
      `https://npmmirror.com/mirrors/node/${NODE_VERSION}/SHASUMS256.txt`,
    ]
    for (const url of urls) {
      let status = ''
      try {
        status = run('curl', ['-sSL', '--max-time', '120', '-o', path, '-w', '%{http_code}', url]).trim()
      } catch {
        /* try the next mirror */
      }
      if (status === '200' && existsSync(path) && statSync(path).size > 0) break
      rmSync(path, { force: true })
    }
  }
  if (!existsSync(path)) throw new Error(`could not read the checksums for ${NODE_VERSION}`)

  const checksums = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([0-9a-f]{64})\s+(\S+)$/.exec(line.trim())
    if (match) checksums[match[2]] = match[1]
  }
  return checksums
}

/**
 * Writes the identity module the plugin compiles against.
 *
 * The plugin cannot read `executa.json` or `package.json` at runtime inside a
 * single executable application, so the two values are generated into the
 * source tree and compiled in. The generator reads the same files the CLI
 * reads, so there is still one source of truth.
 * @returns {void}
 */
function generateIdentity() {
  run(process.execPath, [join(ROOT, 'scripts', 'gen-identity.mjs')])
}

/**
 * Compiles the TypeScript source to JavaScript.
 *
 * The output is CommonJS, because a SEA bundle is loaded as CommonJS and the
 * ESM loader is not available inside one. The imports in the source carry
 * `.js` extensions, which TypeScript keeps, so the compiled files resolve
 * each other on disk exactly as the ESM build does.
 * @returns {string} The directory holding the compiled JavaScript.
 */
function compile() {
  const out = join(WORK, 'dist')
  rmSync(out, { recursive: true, force: true })
  run(process.execPath, [
    join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p',
    join(ROOT, 'tsconfig.json'),
    '--outDir',
    out,
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
  ])
  return out
}

/**
 * Copies the plugin's runtime dependencies into the build tree.
 *
 * The plugin has no runtime dependencies today, so this copies nothing, but
 * the step stays so a future dependency is not silently left out of the
 * binary and discovered on an agent that has no way to install it.
 * @param {string} dist The compiled JavaScript directory.
 * @returns {void}
 */
function stageDependencies(dist) {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const deps = Object.keys(pkg.dependencies ?? {})
  if (deps.length === 0) return
  const modules = join(WORK, 'node_modules')
  mkdirSync(modules, { recursive: true })
  for (const name of deps) {
    const from = join(ROOT, 'node_modules', name)
    if (!existsSync(from)) throw new Error(`dependency ${name} is not installed`)
    cpSync(from, join(modules, name), { recursive: true })
  }
  void dist
}

/**
 * Bundles the compiled modules into one CommonJS file.
 *
 * A single executable application embeds exactly one script. Its `require`
 * resolves built-in modules only, so the compiled tree's `require("./rpc.js")`
 * fails at load with `ERR_UNKNOWN_BUILTIN_MODULE`. The modules are therefore
 * folded into one file with a small registry, and the registry delegates
 * anything it does not own, which is every `node:` built-in, to the host
 * require.
 *
 * The source tree is flat, so a module id is its file name. The leading `./`
 * and the `.js` suffix that TypeScript emits are normalised away.
 * @param {string} dist The compiled JavaScript directory.
 * @returns {string} The path of the bundle.
 */
function bundle(dist) {
  const parts = ['"use strict";', 'const __modules = {']
  for (const file of readdirSync(dist).filter((name) => name.endsWith('.js'))) {
    // A shebang is legal at the top of a CommonJS file but not inside a
    // function body, which is where the module ends up.
    const source = readFileSync(join(dist, file), 'utf8').replace(/^#![^\n]*\n/, '')
    parts.push(`  ${JSON.stringify(file)}: function (module, exports, require) {`)
    parts.push(source)
    parts.push('  },')
  }
  parts.push('};')
  parts.push('const __cache = Object.create(null);')
  parts.push('const __separator = String.fromCharCode(92);')
  parts.push(`function __load(id) {
  if (!id.startsWith('.')) return require(id);
  id = id.split(__separator).join('/');
  while (id.startsWith('./')) id = id.slice(2);
  if (!id.endsWith('.js')) id = id + '.js';
  const cached = __cache[id];
  if (cached !== undefined) return cached.exports;
  const factory = __modules[id];
  if (factory === undefined) throw new Error('bundled module not found: ' + id);
  const module = { exports: {} };
  __cache[id] = module;
  factory(module, module.exports, __load);
  return module.exports;
}`)
  parts.push("__load('./index.js');")

  const path = join(WORK, 'bundle.js')
  writeFileSync(path, parts.join('\n'), 'utf8')
  return path
}

/**
 * Writes the SEA configuration for the bundle.
 * @param {string} bundlePath The bundled JavaScript file.
 * @param {string} blobPath Where the blob is written.
 * @returns {string} The path of the configuration file.
 */
function writeSeaConfig(bundlePath, blobPath) {
  const config = {
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }
  const path = join(WORK, 'sea-config.json')
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf8')
  return path
}

/**
 * Builds the executable for one platform.
 *
 * The host binary is a copy of the Node runtime for the target platform, and
 * the script is injected into it. Every step runs on this machine, so no
 * runner per platform is needed.
 * @param {string} key The platform key.
 * @param {{node: string, archive: string, exe: string}} spec The platform spec.
 * @param {string} dist The compiled JavaScript directory.
 * @param {string} blobPath The path of the built blob.
 * @returns {string} The path of the finished executable.
 */
async function buildOne(key, spec, dist, blobPath) {
  const stage = join(WORK, key)
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })

  const hostBinary = join(stage, spec.exe)
  const isWindows = spec.node === 'win-x64'
  // Node publishes its archives under the release tag, so the file name
  // carries the leading `v` and is the key the published checksums use.
  const filename = `node-${NODE_VERSION}-${spec.node}.${isWindows ? 'zip' : 'tar.gz'}`
  const cached = join(WORK, 'cache', filename)
  const downloaded = join(stage, isWindows ? 'node.zip' : 'node.tar.gz')

  // The runtime is fetched by scripts/fetch-node.mjs, which resumes a
  // transfer that the network cuts short. The cache means the slow part
  // happens once rather than on every build.
  if (!existsSync(cached) || createHash('sha256').update(readFileSync(cached)).digest('hex') !== checksums[filename]) {
    process.stdout.write(`  fetching node ${spec.node} ${NODE_VERSION}\n`)
    run(process.execPath, [join(ROOT, 'scripts', 'fetch-node.mjs'), spec.node, checksums[filename]])
  } else {
    process.stdout.write(`  node ${spec.node} ${NODE_VERSION} already cached\n`)
  }
  cpSync(cached, downloaded)

  const unpacked = join(stage, 'unpacked')
  mkdirSync(unpacked, { recursive: true })
  if (isWindows) {
    run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path '${downloaded}' -DestinationPath '${unpacked}' -Force`])
  } else {
    // Only the runtime is extracted. A macOS tarball also carries symlinks
    // such as bin/npm, and creating a symlink on Windows needs a privilege
    // the build has no reason to ask for.
    run('tar', ['-xzf', downloaded, '-C', unpacked, `node-${NODE_VERSION}-${spec.node}/bin/node`])
  }

  const inner = join(unpacked, `node-${NODE_VERSION}-${spec.node}`)
  const source = isWindows ? join(inner, 'node.exe') : join(inner, 'bin', 'node')
  if (!existsSync(source)) throw new Error(`node runtime not found at ${source}`)

  // The Windows executable must carry the .exe name, everything else runs
  // straight from the copied runtime.
  cpSync(source, hostBinary)
  if (!isWindows) makeExecutable(hostBinary, 0o755)

  // The script itself.
  const payload = join(stage, 'payload')
  mkdirSync(payload, { recursive: true })
  cpSync(dist, payload, { recursive: true })

  // Inject. The sentinel fuse stops the runtime from treating an
  // uninjected binary as a valid application.
  const sentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
  run(process.execPath, [
    join(ROOT, 'node_modules', 'postject', 'dist', 'cli.js'),
    hostBinary,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    sentinel,
  ])

  // Injection drops the signature Node shipped with. Linux and Windows do not
  // read it, but an unsigned arm64 executable is refused by the macOS kernel,
  // so the macOS targets are signed again before they are packaged.
  if (key.startsWith('darwin-')) signMachO(hostBinary)

  return hostBinary
}

/**
 * Makes a file executable.
 * @param {string} path The file to change.
 * @param {number} mode The octal mode.
 * @returns {void}
 */
function makeExecutable(path, mode) {
  try {
    chmodSync(path, mode)
  } catch {
    /* Windows has no chmod, the mode is carried by the archive instead. */
  }
}

/**
 * Packages one executable into an archive with the entrypoint under `bin/`.
 *
 * The archive holds `bin/<exe>`, which is the layout the platform's binary
 * convention uses. On Unix the tar format carries the 0o755 mode, so the
 * executable arrives with its permission bit intact rather than as a file
 * the agent cannot start.
 * @param {string} key The platform key.
 * @param {{node: string, archive: string, exe: string}} spec The platform spec.
 * @param {string} binary The executable to package.
 * @param {{toolId: string, version: string}} identity The baked identity.
 * @returns {string} The path of the archive.
 */
function packageArchive(key, spec, binary, identity) {
  const stage = join(WORK, `pkg-${key}`)
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(join(stage, 'bin'), { recursive: true })

  const entryName = spec.exe
  const entryPath = join(stage, 'bin', entryName)
  cpSync(binary, entryPath)
  if (spec.archive !== 'zip') makeExecutable(entryPath, 0o755)

  // No manifest is written into the archive. The entrypoint the agent runs
  // is the one declared in executa.json and sent with the upload, and on
  // Unix the tar format carries the 0o755 mode. A second manifest under the
  // same name as the protocol manifest would only invite confusion.

  mkdirSync(OUT, { recursive: true })
  const archive = join(OUT, `assay-core-${identity.version}-${key}.${spec.archive === 'zip' ? 'zip' : 'tar.gz'}`)
  rmSync(archive, { force: true })

  if (spec.archive === 'zip') {
    // The archive is written by the shared zip writer, because the shell
    // Compress-Archive writes backslash entry names, and the agent resolves
    // the entrypoint against forward slashes.
    writeFileSync(archive, buildZip(collect(stage)))
  } else {
    // Likewise for tar: the system tool records the Windows file mode, which
    // has no executable bit, so the archive writer sets it instead.
    writeFileSync(archive, buildTarGz(collect(stage)))
  }
  return archive
}

/**
 * Collects every file under a directory as a ZIP entry.
 *
 * The paths use forward slashes because that is what the agent resolves the
 * entrypoint against on Linux and macOS.
 * @param {string} dir The directory to collect.
 * @param {string} [base] The directory paths are made relative to.
 * @returns {Array<{path: string, data: Buffer, executable: boolean}>} The entries.
 */
function collect(dir, base = dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      entries.push(...collect(full, base))
      continue
    }
    const path = relative(base, full).split('\\').join('/')
    entries.push({
      path,
      data: readFileSync(full),
      executable: path.startsWith('bin/'),
    })
  }
  return entries
}

const [only] = process.argv.slice(2)
const targets = only ? { [only]: PLATFORMS[only] } : PLATFORMS
if (only && !PLATFORMS[only]) {
  process.stderr.write(`unknown platform ${only}\nknown: ${Object.keys(PLATFORMS).join(', ')}\n`)
  process.exit(1)
}

const identity = readIdentity()
process.stdout.write(`baking tool_id ${identity.toolId} version ${identity.version}\n`)

// The downloaded runtimes are kept between builds. Fetching one is the slow
// part, and a build that deletes the cache re-downloads several hundred
// megabytes every time. Everything else in the work tree is rebuilt.
mkdirSync(WORK, { recursive: true })
for (const name of readdirSync(WORK)) {
  if (name === 'cache') continue
  rmSync(join(WORK, name), { recursive: true, force: true })
}
const checksums = readChecksums()
generateIdentity()
const dist = compile()
stageDependencies(dist)

const blobPath = join(WORK, 'sea.blob')
const bundlePath = bundle(dist)
writeSeaConfig(bundlePath, blobPath)
run(process.execPath, ['--experimental-sea-config', join(WORK, 'sea-config.json')])
if (!existsSync(blobPath)) throw new Error('the sea blob was not produced')
process.stdout.write(`blob ${(readFileSync(blobPath).length / 1024 / 1024).toFixed(1)} MB\n`)

for (const [key, spec] of Object.entries(targets)) {
  process.stdout.write(`building ${key}\n`)
  const binary = await buildOne(key, spec, dist, blobPath)
  const archive = packageArchive(key, spec, binary, identity)
  const size = (readFileSync(archive).length / 1024 / 1024).toFixed(1)
  process.stdout.write(`  ${archive.replace(ROOT, '.')}  ${size} MB\n`)
}

process.stdout.write('\ndone\n')
