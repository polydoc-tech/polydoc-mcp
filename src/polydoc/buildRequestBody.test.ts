import { describe, expect, it } from 'vitest'
import { buildRequestBody, mergeDeep, type PolyDocParams } from './buildRequestBody.js'

function base(overrides: Partial<PolyDocParams>): PolyDocParams {
  return {
    operation: 'pdf',
    sourceType: 'url',
    url: 'https://example.com',
    delivery: { mode: 'download' },
    ...overrides,
  }
}

describe('buildRequestBody', () => {
  it('PDF from URL targets /pdf/convert and is binary', () => {
    const r = buildRequestBody(base({}))
    expect(r.endpoint).toBe('/pdf/convert')
    expect(r.isBinary).toBe(true)
    expect(r.body).toEqual({ source: 'https://example.com' })
  })

  it('HTML source passes the raw HTML through', () => {
    const r = buildRequestBody(base({ sourceType: 'html', html: '<h1>Hi</h1>', url: undefined }))
    expect(r.body.source).toBe('<h1>Hi</h1>')
  })

  it('Template source is wrapped as [template:ID] and carries templateData', () => {
    const r = buildRequestBody(
      base({
        sourceType: 'template',
        templateId: 'jlE-whg',
        url: undefined,
        templateData: { invoice_number: 'INV-1' },
      })
    )
    expect(r.body.source).toBe('[template:jlE-whg]')
    expect(r.body.templateData).toEqual({ invoice_number: 'INV-1' })
  })

  it('omits empty templateData', () => {
    const r = buildRequestBody(base({ sourceType: 'template', templateId: 'x', templateData: {} }))
    expect(r.body).not.toHaveProperty('templateData')
  })

  it('maps PDF options into a layout object, dropping unset fields', () => {
    const r = buildRequestBody(
      base({ pdfOptions: { format: 'A4', landscape: true, marginTop: '10mm' } })
    )
    expect(r.body.layout).toEqual({
      format: 'A4',
      landscape: true,
      margin: { top: '10mm', right: '0', bottom: '0', left: '0' },
    })
  })

  it('does not attach a layout when no PDF options are set', () => {
    const r = buildRequestBody(base({ pdfOptions: {} }))
    expect(r.body).not.toHaveProperty('layout')
  })

  it('Screenshot targets /screenshot/convert and nests viewport', () => {
    const r = buildRequestBody(
      base({
        operation: 'screenshot',
        screenshotOptions: {
          imageType: 'jpeg',
          fullPage: true,
          viewportWidth: 1024,
          viewportHeight: 768,
          devicePixelRatio: 2,
        },
      })
    )
    expect(r.endpoint).toBe('/screenshot/convert')
    expect(r.body.screenshot).toEqual({
      type: 'jpeg',
      fullPage: true,
      viewport: { width: 1024, height: 768, devicePixelRatio: 2 },
    })
  })

  it('E-Invoice nests the eInvoice payload and uses /pdf/convert', () => {
    const r = buildRequestBody(
      base({
        operation: 'einvoice',
        sourceType: 'html',
        html: '<h1>Invoice</h1>',
        url: undefined,
        eInvoiceStandard: 'zugferd',
        eInvoiceProfile: 'en16931',
        eInvoiceVerify: true,
        invoice: { number: 'INV-1' },
      })
    )
    expect(r.endpoint).toBe('/pdf/convert')
    expect(r.body.eInvoice).toEqual({
      standard: 'zugferd',
      profile: 'en16931',
      invoice: { number: 'INV-1' },
      verify: true,
    })
  })

  it('Cloud Storage delivery is non-binary and sets cloudStorage', () => {
    const r = buildRequestBody(
      base({ delivery: { mode: 'cloudStorage', presignedUrl: 'https://put.example/abc' } })
    )
    expect(r.isBinary).toBe(false)
    expect(r.body.cloudStorage).toEqual({ presignedUrl: 'https://put.example/abc' })
  })

  it('Webhook delivery is non-binary and sets the webhook object', () => {
    const r = buildRequestBody(
      base({ delivery: { mode: 'webhook', webhook: { url: 'https://hook', async: true } } })
    )
    expect(r.isBinary).toBe(false)
    expect(r.body.webhook).toEqual({ url: 'https://hook', async: true })
  })

  it('deep-merges advanced JSON into the body (advanced wins)', () => {
    const r = buildRequestBody(
      base({
        pdfOptions: { format: 'A4' },
        advanced: { pdf: { pdfa: { level: '3b' } }, layout: { landscape: true } },
      })
    )
    expect((r.body.pdf as Record<string, unknown>).pdfa).toEqual({ level: '3b' })
    // advanced.layout merges with the generated layout rather than replacing it
    expect(r.body.layout).toEqual({ format: 'A4', landscape: true })
  })

  it('includes filename, tag and positive timeout when provided', () => {
    const r = buildRequestBody(base({ filename: 'out.pdf', tag: 'run1', timeout: 60000 }))
    expect(r.body.filename).toBe('out.pdf')
    expect(r.body.tag).toBe('run1')
    expect(r.body.timeout).toBe(60000)
  })
})

describe('mergeDeep', () => {
  it('merges nested objects without losing sibling keys', () => {
    expect(mergeDeep({ a: { x: 1 }, b: 2 }, { a: { y: 2 } })).toEqual({ a: { x: 1, y: 2 }, b: 2 })
  })

  it('overwrites scalars and arrays', () => {
    expect(mergeDeep({ a: 1, list: [1, 2] }, { a: 9, list: [3] })).toEqual({ a: 9, list: [3] })
  })

  it('ignores prototype-pollution keys in the source', () => {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":"yes"},"constructor":{"polluted":"yes"},"safe":"kept"}',
    )
    const merged = mergeDeep({ existing: 1 }, malicious) as Record<string, unknown>
    expect(merged.safe).toBe('kept')
    expect(merged.existing).toBe(1)
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
    expect(merged.polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
