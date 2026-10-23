/**
 * A minimal, dependency-free tar.gz writer.
 *
 * The archive has to carry the executable bit explicitly. On Windows the file
 * mode is a fiction: `chmodSync` does nothing, and a tar written by the system
 * tool records 0644, so the platform extracts the entrypoint as a file it is
 * not allowed to run and the tool fails with "permission denied" before it
 * ever answers. Writing the header here makes the mode a fact of the archive
 * rather than a property of the machine that built it.
 *
 * The output is reproducible: one fixed timestamp, no owner names that vary,
 * and no gzip mtime.
 */

import { gzipSync } from 'node:zlib'

/** Every tar record is a multiple of this many bytes. */
const BLOCK = 512

/**
 * Formats a number as a NUL-terminated octal field.
 * @param {number} value The number.
 * @param {number} width The field width, including the terminator.
 * @returns {string} The field.
 */
function octal(value, width) {
  return `${value.toString(8).padStart(width - 1, '0')}\0`
}

/**
 * Builds one ustar header block.
 * @param {{path: string, data: Buffer, executable?: boolean}} entry The entry.
 * @returns {Buffer} The 512-byte header.
 */
function header(entry) {
  const name = Buffer.from(entry.path, 'utf8')
  if (name.length > 100) throw new Error(`tar entry name is too long: ${entry.path}`)

  const block = Buffer.alloc(BLOCK)
  name.copy(block, 0)
  // Mode (8), uid (8), gid (8), size (12), mtime (12).
  block.write(octal(entry.executable ? 0o755 : 0o644, 8), 100, 8, 'ascii')
  block.write(octal(0, 8), 108, 8, 'ascii')
  block.write(octal(0, 8), 116, 8, 'ascii')
  block.write(octal(entry.data.length, 12), 124, 12, 'ascii')
  block.write(octal(0, 12), 136, 12, 'ascii')
  // The checksum is computed with the field filled with spaces.
  block.write('        ', 148, 8, 'ascii')
  block.write('0', 156, 1, 'ascii')
  block.write('ustar\0', 257, 6, 'ascii')
  block.write('00', 263, 2, 'ascii')
  block.write('root', 265, 4, 'ascii')
  block.write('root', 297, 4, 'ascii')

  let sum = 0
  for (const byte of block) sum += byte
  block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii')
  return block
}

/**
 * Builds a gzipped tar archive in memory.
 * @param {Array<{path: string, data: Buffer|string, executable?: boolean}>} entries
 *   One record per file, with a forward-slash path. `executable` stores mode
 *   0755, which is what the declared entrypoint needs so the platform can
 *   exec it.
 * @returns {Buffer} The archive bytes.
 */
export function buildTarGz(entries) {
  const chunks = []
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8')
    chunks.push(header({ ...entry, data }), data)
    const padding = (BLOCK - (data.length % BLOCK)) % BLOCK
    if (padding > 0) chunks.push(Buffer.alloc(padding))
  }
  chunks.push(Buffer.alloc(BLOCK * 2))
  return gzipSync(Buffer.concat(chunks), { level: 9 })
}
