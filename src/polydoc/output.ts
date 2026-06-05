import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { UserInputError } from './errors.js'

/**
 * Raw-byte ceiling above which a screenshot is not inlined as an MCP image block.
 * Base64 inflates by ~4/3, so this keeps inline images well under the ~1 MB that
 * clients tend to choke on; larger captures are returned as a path only.
 */
export const SCREENSHOT_INLINE_MAX_BYTES = 512 * 1024

/**
 * Resolve a caller-supplied output name to an absolute path inside the jail root.
 * Refuses absolute paths and any '..' traversal, so a written file can never
 * escape POLYDOC_OUTPUT_DIR.
 */
export function jailPath(outputDir: string, name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new UserInputError('filename must not be empty')
  }
  if (path.isAbsolute(trimmed)) {
    throw new UserInputError('filename must be a relative name, not an absolute path')
  }
  if (trimmed.split(/[\\/]/).includes('..')) {
    throw new UserInputError("filename must not contain '..' path segments")
  }
  const abs = path.resolve(outputDir, trimmed)
  if (abs !== outputDir && !abs.startsWith(outputDir + path.sep)) {
    throw new UserInputError('resolved output path escapes the configured output directory')
  }
  return abs
}

/** Write bytes to a jailed path under outputDir, creating the directory as needed. */
export async function writeBinaryFile(
  outputDir: string,
  name: string,
  bytes: Uint8Array
): Promise<string> {
  const abs = jailPath(outputDir, name)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, bytes)
  return abs
}

export type WriteFileFn = typeof writeBinaryFile
