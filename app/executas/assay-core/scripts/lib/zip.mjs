/**
 * A minimal, dependency-free ZIP writer.
 *
 * The archives have to be byte-identical on every machine that builds them, and
 * entry names have to use forward slashes. Windows `Compress-Archive` writes
 * backslash separators, which resolve fine locally and break the moment the
 * platform extracts the archive on Linux or macOS, where the entrypoint
 * `dist/index.js` would not be found.
 *
 * So the writer is explicit. Store or deflate, no timestamps beyond a fixed
 * value so two builds of the same input produce the same bytes.
 */

import { deflateRawSync } from 'node:zlib'

/** The fixed DOS timestamp, 1980-01-01 00:00, so builds are reproducible. */
const DOS_TIME = 0
const DOS_DATE = 33

/**
 * Builds the CRC-32 lookup table once.
 * @returns The table.
 */
function makeTable() {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
}

const CRC_TABLE = makeTable()

/**
 * Computes a CRC-32 over a buffer.
 * @param buffer The bytes to sum.
 * @returns The checksum.
 */
export function crc32(buffer) {
  let crc = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Builds a ZIP archive in memory.
 * @param entries One record per file, with a forward-slash path. A record may
 *   carry `executable: true` to store mode 0755, which is what the declared
 *   entrypoint needs so the platform can exec it.
 * @returns The archive bytes.
 */
export function buildZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.path.split('/').join('/'), 'utf8')
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8')

    // Never let deflate make a small file bigger.
    const deflated = deflateRawSync(raw, { level: 9 })
    const useDeflate = deflated.length < raw.length
    const payload = useDeflate ? deflated : raw
    const method = useDeflate ? 8 : 0
    const checksum = crc32(raw)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)

    locals.push(local, nameBytes, payload)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(DOS_TIME, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(payload.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    // Unix mode in the high 16 bits. 0755 for the entrypoint so the platform
    // can exec it, 0644 for everything else. The shift is coerced back to
    // unsigned, because the value overflows into a negative int in JS and
    // writeUInt32LE refuses negative values.
    const mode = entry.executable ? 0o100755 : 0o100644
    central.writeUInt32LE((mode << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)

    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + payload.length
  }

  const centralBuffer = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, centralBuffer, end])
}
