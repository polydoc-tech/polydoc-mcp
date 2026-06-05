import { describe, expect, it } from 'vitest'
import { convert } from '../src/polydoc/client.js'
import { buildRequestBody, type PolyDocParams } from '../src/polydoc/buildRequestBody.js'

// Live smoke test against the real PolyDoc API. Skipped unless POLYDOC_API_KEY is
// set; always uses sandbox so it draws sandbox quota, never production. Requests
// go through the same client.convert + buildRequestBody the server uses, so this
// validates the client against the live contract. Calls are spaced for the
// ~5 requests/sec sandbox limit.
const API_KEY = process.env.POLYDOC_API_KEY
const BASE = (process.env.POLYDOC_BASE_URL ?? 'https://api.polydoc.tech').replace(/\/+$/, '')
const TEMPLATE_ID = process.env.POLYDOC_TEMPLATE_ID ?? 'jlE-whg'
const SPACING_MS = 400

const space = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, SPACING_MS))

function run(params: PolyDocParams) {
  return convert(buildRequestBody(params), { apiKey: API_KEY!, baseUrl: BASE, sandbox: true })
}

const dl = { mode: 'download' as const }

describe.skipIf(!API_KEY)('PolyDoc live API (sandbox)', () => {
  it('PDF from inline HTML returns a PDF', async () => {
    const res = await run({ operation: 'pdf', sourceType: 'html', html: '<h1>Smoke</h1>', delivery: dl })
    expect(res.kind).toBe('binary')
    if (res.kind === 'binary') {
      expect(res.contentType).toContain('application/pdf')
      expect(res.bytes.length).toBeGreaterThan(1000)
      expect(Buffer.from(res.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-')
    }
    await space()
  })

  it('PDF from a saved template renders', async () => {
    const res = await run({
      operation: 'pdf',
      sourceType: 'template',
      templateId: TEMPLATE_ID,
      delivery: dl,
    })
    expect(res.kind).toBe('binary')
    if (res.kind === 'binary') expect(res.contentType).toContain('application/pdf')
    await space()
  })

  it('Screenshot of a URL returns a PNG', async () => {
    const res = await run({
      operation: 'screenshot',
      sourceType: 'url',
      url: 'https://example.com',
      screenshotOptions: { imageType: 'png' },
      delivery: dl,
    })
    expect(res.kind).toBe('binary')
    if (res.kind === 'binary') expect(res.contentType).toContain('image/png')
    await space()
  })

  it('E-Invoice (ZUGFeRD / EN 16931) returns a hybrid PDF', async () => {
    const invoice = {
      number: 'INV-SMOKE-1',
      issueDate: '2026-06-04',
      dueDate: '2026-07-04',
      currencyCode: 'EUR',
      seller: {
        name: 'Acme GmbH',
        address: { line1: 'Hauptstr. 1', city: 'Berlin', postalCode: '10115', countryCode: 'DE' },
        taxId: 'DE123456789',
      },
      buyer: {
        name: 'Buyer SARL',
        address: { line1: 'Rue 2', city: 'Paris', postalCode: '75001', countryCode: 'FR' },
      },
      lines: [
        {
          description: 'Widget',
          quantity: 2,
          unitPrice: 10,
          lineTotal: 20,
          vatRate: 19,
          vatCategoryCode: 'S',
        },
      ],
      taxSummary: [{ categoryCode: 'S', rate: 19, taxableAmount: 20, taxAmount: 3.8 }],
      paymentTerms: 'Net 30 days',
      totalNetAmount: 20,
      totalTaxAmount: 3.8,
      totalGrossAmount: 23.8,
    }
    const res = await run({
      operation: 'einvoice',
      sourceType: 'html',
      html: '<h1>Invoice INV-SMOKE-1</h1>',
      eInvoiceStandard: 'zugferd',
      eInvoiceProfile: 'en16931',
      invoice,
      delivery: dl,
    })
    expect(res.kind).toBe('binary')
    if (res.kind === 'binary') expect(res.contentType).toContain('application/pdf')
    await space()
  })

  it('credential check (minimal sandbox screenshot) succeeds', async () => {
    const res = await run({
      operation: 'screenshot',
      sourceType: 'html',
      html: '<p>polydoc</p>',
      screenshotOptions: { imageType: 'png' },
      delivery: dl,
    })
    expect(res.kind).toBe('binary')
  })
})
