import { describe, expect, it } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { jailPath, writeBinaryFile } from './output.js'
import { UserInputError } from './errors.js'

describe('jailPath', () => {
  const root = path.resolve('/var/data/polydoc')

  it('resolves a bare filename inside the jail', () => {
    expect(jailPath(root, 'report.pdf')).toBe(path.join(root, 'report.pdf'))
  })

  it('allows a relative subpath inside the jail', () => {
    expect(jailPath(root, 'sub/report.pdf')).toBe(path.join(root, 'sub', 'report.pdf'))
  })

  it('rejects absolute paths', () => {
    expect(() => jailPath(root, '/etc/passwd')).toThrow(UserInputError)
  })

  it('rejects .. traversal', () => {
    expect(() => jailPath(root, '../escape.pdf')).toThrow(UserInputError)
    expect(() => jailPath(root, 'a/../../escape.pdf')).toThrow(UserInputError)
  })

  it('rejects empty names', () => {
    expect(() => jailPath(root, '   ')).toThrow(UserInputError)
  })
})

describe('writeBinaryFile', () => {
  it('writes bytes and returns the absolute jailed path', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'polydoc-test-'))
    try {
      const bytes = new Uint8Array([1, 2, 3, 4])
      const p = await writeBinaryFile(dir, 'out/file.bin', bytes)
      expect(p).toBe(path.join(dir, 'out', 'file.bin'))
      const read = await readFile(p)
      expect(new Uint8Array(read)).toEqual(bytes)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('refuses to write outside the jail', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'polydoc-test-'))
    try {
      await expect(
        writeBinaryFile(dir, '../escape.bin', new Uint8Array([0]))
      ).rejects.toThrow(UserInputError)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
