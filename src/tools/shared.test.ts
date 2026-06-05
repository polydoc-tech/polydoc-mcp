import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import {
  inputToParams,
  runConversion,
  runTestCredentials,
  type ConversionDeps,
} from './shared.js'
import { writeBinaryFile } from '../polydoc/output.js'
import { PolyDocApiError } from '../polydoc/errors.js'
import type { ConvertOptions, ConvertResult } from '../polydoc/client.js'
import type { PolyDocRequest } from '../polydoc/buildRequestBody.js'
import type { Config } from '../polydoc/config.js'

let outputDir: string

beforeEach(async () => {
  outputDir = await mkdtemp(path.join(os.tmpdir(), 'polydoc-mcp-test-'))
})

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true })
})

function config(): Config {
  return { apiKey: 'test-key', baseUrl: 'https://api.example', sandbox: false, outputDir }
}

interface Capture {
  request?: PolyDocRequest
  opts?: ConvertOptions
}

function deps(result: ConvertResult | PolyDocApiError, capture: Capture = {}): ConversionDeps {
  return {
    config: config(),
    writeFile: writeBinaryFile,
    convert: async (request, opts) => {
      capture.request = request
      capture.opts = opts
      if (result instanceof PolyDocApiError) throw result
      return result
    },
  }
}

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]) // %PDF-
const pdfBinary: ConvertResult = {
  kind: 'binary',
  bytes: PDF_BYTES,
  contentType: 'application/pdf',
  conversionId: 'conv-1',
  creditUsed: '1',
}

describe('inputToParams', () => {
  it('maps a PDF url source', () => {
    const p = inputToParams('pdf', { url: 'https://example.com' })
    expect(p.sourceType).toBe('url')
    expect(p.delivery.mode).toBe('download')
  })

  it('rejects when no source is given', () => {
    expect(() => inputToParams('pdf', {})).toThrow(/exactly one/)
  })

  it('rejects when two sources are given', () => {
    expect(() => inputToParams('pdf', { url: 'https://x', html: '<p>x</p>' })).toThrow(/exactly one/)
  })

  it('rejects cloudStorage without presignedUrl', () => {
    expect(() =>
      inputToParams('pdf', { url: 'https://x', delivery: 'cloudStorage' })
    ).toThrow(/presignedUrl/)
  })

  it('rejects webhook without a url', () => {
    expect(() =>
      inputToParams('pdf', { url: 'https://x', delivery: 'webhook', webhook: {} })
    ).toThrow(/webhook/)
  })

  it('defaults e-invoice standard and profile', () => {
    const p = inputToParams('einvoice', { html: '<p>inv</p>', invoice: { number: 'INV-1' } })
    expect(p.eInvoiceStandard).toBe('zugferd')
    expect(p.eInvoiceProfile).toBe('en16931')
  })
})

describe('runConversion (download)', () => {
  it('writes the PDF and returns its path + metadata', async () => {
    const cap: Capture = {}
    const res = await runConversion('pdf', { html: '<h1>hi</h1>', filename: 'out.pdf' }, deps(pdfBinary, cap))

    expect(cap.request?.endpoint).toBe('/pdf/convert')
    expect(cap.request?.body.source).toBe('<h1>hi</h1>')
    expect(cap.opts?.sandbox).toBe(false)

    expect(res.isError).toBeFalsy()
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.delivery).toBe('download')
    expect(sc.sizeBytes).toBe(PDF_BYTES.length)
    expect(sc.conversionId).toBe('conv-1')
    expect(sc.filePath).toBe(path.join(outputDir, 'out.pdf'))
    const written = await readFile(sc.filePath as string)
    expect(new Uint8Array(written)).toEqual(PDF_BYTES)
  })

  it('basenames a filename so it cannot escape the output dir', async () => {
    const res = await runConversion(
      'pdf',
      { html: '<h1>hi</h1>', filename: '../../evil.pdf' },
      deps(pdfBinary)
    )
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.filePath).toBe(path.join(outputDir, 'evil.pdf'))
  })

  it('honors the per-call sandbox override', async () => {
    const cap: Capture = {}
    await runConversion('pdf', { html: '<p>x</p>', sandbox: true }, deps(pdfBinary, cap))
    expect(cap.opts?.sandbox).toBe(true)
  })

  it('includes base64 in structured output when requested', async () => {
    const res = await runConversion('pdf', { html: '<p>x</p>', returnBase64: true }, deps(pdfBinary))
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.base64).toBe(Buffer.from(PDF_BYTES).toString('base64'))
  })
})

describe('runConversion (screenshot image block)', () => {
  it('returns an inline image for a small screenshot', async () => {
    const png: ConvertResult = {
      kind: 'binary',
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      contentType: 'image/png',
    }
    const res = await runConversion('screenshot', { url: 'https://x' }, deps(png))
    expect(res.content.some((c) => c.type === 'image')).toBe(true)
  })

  it('omits the inline image for a large screenshot', async () => {
    const big: ConvertResult = {
      kind: 'binary',
      bytes: new Uint8Array(513 * 1024),
      contentType: 'image/png',
    }
    const res = await runConversion('screenshot', { url: 'https://x' }, deps(big))
    expect(res.content.some((c) => c.type === 'image')).toBe(false)
    expect(res.content.some((c) => c.type === 'text' && /too large/i.test(c.text))).toBe(true)
  })
})

describe('runConversion (cloud / webhook delivery)', () => {
  it('returns the delivery URL and writes no file', async () => {
    const json: ConvertResult = {
      kind: 'json',
      json: { success: true, data: { url: 'https://bucket/out.pdf' } },
      conversionId: 'conv-2',
    }
    const res = await runConversion(
      'pdf',
      { html: '<p>x</p>', delivery: 'cloudStorage', presignedUrl: 'https://put/abc' },
      deps(json)
    )
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.delivery).toBe('cloudStorage')
    expect(sc.url).toBe('https://bucket/out.pdf')
    expect(sc.filePath).toBeUndefined()
  })
})

describe('runConversion (errors)', () => {
  it('surfaces an API error as isError with no structured content', async () => {
    const err = new PolyDocApiError(422, 'BR-CO-25 requires dueDate or paymentTerms')
    const res = await runConversion('einvoice', { html: '<p>x</p>', invoice: { number: 'x' } }, deps(err))
    expect(res.isError).toBe(true)
    expect(res.structuredContent).toBeUndefined()
    expect(res.content[0].type === 'text' && res.content[0].text).toContain('422')
  })

  it('surfaces an input error as isError', async () => {
    const res = await runConversion('pdf', {}, deps(pdfBinary))
    expect(res.isError).toBe(true)
    expect(res.content[0].type === 'text' && res.content[0].text).toMatch(/exactly one/)
  })
})

describe('runTestCredentials', () => {
  it('reports ok and forces sandbox', async () => {
    const cap: Capture = {}
    const res = await runTestCredentials(deps(pdfBinary, cap))
    expect(cap.opts?.sandbox).toBe(true)
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.ok).toBe(true)
    expect(sc.status).toBe(200)
    expect(res.isError).toBeFalsy()
  })

  it('reports a rejected key as ok:false (not an error result)', async () => {
    const res = await runTestCredentials(deps(new PolyDocApiError(401, 'unauthorized')))
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.ok).toBe(false)
    expect(sc.status).toBe(401)
    expect(res.isError).toBeFalsy()
  })
})
