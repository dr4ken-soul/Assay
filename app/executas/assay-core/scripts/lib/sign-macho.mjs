/**
 * Re-signs a Mach-O executable after the SEA blob has been injected.
 *
 * `postject` rewrites the Mach-O load commands and drops the signature the
 * official Node runtime carried. That is invisible on Linux and Windows, but
 * Apple Silicon refuses to execute an unsigned arm64 binary, so the artifact
 * would be dead on arrival on a Mac. The repair is an ad-hoc signature, the
 * same one `codesign --sign -` produces, written after injection and before
 * the archive is sealed.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, renameSync, rmSync } from 'node:fs'
import { ensureRcodesign } from '../fetch-rcodesign.mjs'

/** The load command that points at the code signature blob. */
const LC_CODE_SIGNATURE = 0x1d

/**
 * Tests one thin Mach-O image for a code signature load command.
 * @param {Buffer} buffer The file.
 * @param {number} offset The image's start within the file.
 * @returns {boolean|null} True or false, or null when the bytes are not Mach-O.
 */
function thinHasSignature(buffer, offset) {
  if (offset + 28 > buffer.length) return null
  const magic = buffer.readUInt32BE(offset)
  let little
  let is64
  if (magic === 0xfeedfacf) {
    little = false
    is64 = true
  } else if (magic === 0xcffaedfe) {
    little = true
    is64 = true
  } else if (magic === 0xfeedface) {
    little = false
    is64 = false
  } else if (magic === 0xcefaedfe) {
    little = true
    is64 = false
  } else {
    return null
  }

  const read = (at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at))
  const commands = read(offset + 16)
  const bytes = read(offset + 20)
  let cursor = offset + (is64 ? 32 : 28)
  const end = Math.min(cursor + bytes, buffer.length)
  for (let index = 0; index < commands && cursor + 8 <= end; index += 1) {
    const command = read(cursor)
    const size = read(cursor + 4)
    if (command === LC_CODE_SIGNATURE) return true
    if (size < 8) break
    cursor += size
  }
  return false
}

/**
 * Tests a Mach-O file, fat or thin, for a code signature.
 * @param {Buffer} buffer The file.
 * @returns {boolean} Whether a signature load command is present.
 */
export function hasCodeSignature(buffer) {
  if (buffer.length < 8) return false
  if (buffer.readUInt32BE(0) === 0xcafebabe) {
    const images = buffer.readUInt32BE(4)
    let found = false
    for (let index = 0; index < images; index += 1) {
      const at = 8 + index * 20
      if (at + 12 > buffer.length) return false
      const offset = buffer.readUInt32BE(at + 8)
      const result = thinHasSignature(buffer, offset)
      if (result === false) return false
      if (result === true) found = true
    }
    return found
  }
  return thinHasSignature(buffer, 0) === true
}

/**
 * Signs a Mach-O executable in place.
 *
 * On a Mac the system `codesign` is used. Everywhere else the pinned
 * `rcodesign` build writes the same ad-hoc signature, so the artifact does not
 * depend on which machine produced it.
 * @param {string} path The executable to sign.
 * @returns {void}
 */
export function signMachO(path) {
  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--force', '--sign', '-', path], { stdio: 'inherit' })
  } else {
    const signer = ensureRcodesign()
    const signed = `${path}.signed`
    rmSync(signed, { force: true })
    execFileSync(signer, ['sign', path, signed], { stdio: 'inherit' })
    renameSync(signed, path)
  }

  if (!hasCodeSignature(readFileSync(path))) {
    throw new Error(`signing did not produce a code signature: ${path}`)
  }
}
