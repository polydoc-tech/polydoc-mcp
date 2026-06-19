import { z } from 'zod'

export const PAGE_FORMATS = [
  'A3',
  'A4',
  'A5',
  'Ledger',
  'Legal',
  'Letter',
  'Tabloid',
] as const

export const IMAGE_TYPES = ['png', 'jpeg', 'webp'] as const
export const EINVOICE_STANDARDS = ['zugferd', 'facturx'] as const
export const EINVOICE_PROFILES = ['minimum', 'basicwl', 'basic', 'en16931', 'extended'] as const

/** Source selection plus optional template variables, shared by every tool. */
export const sourceShape = {
  url: z
    .string()
    .optional()
    .describe('Public URL to render. Provide exactly one of url, html, or templateId.'),
  html: z
    .string()
    .optional()
    .describe('Inline HTML to render. Provide exactly one of url, html, or templateId.'),
  templateId: z
    .string()
    .optional()
    .describe(
      'ID of a saved PolyDoc template. Provide exactly one of url, html, or templateId.'
    ),
  templateData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Variables for the Liquid template (used with templateId).'),
}

/** Delivery target. Download returns a file; cloud/webhook return a URL or ack. */
export const deliveryShape = {
  delivery: z
    .enum(['download', 'cloudStorage', 'webhook'])
    .default('download')
    .describe(
      'download writes the file locally; cloudStorage uploads to a presigned URL; webhook posts the file to a URL.'
    ),
  presignedUrl: z
    .string()
    .optional()
    .describe('Presigned PUT URL, required when delivery is cloudStorage.'),
  webhook: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Webhook config, required when delivery is webhook. Shape: { url, async?, method?, headers?, retries? }.'
    ),
}

/** Fields every tool accepts on top of source and delivery. */
export const commonExtrasShape = {
  filename: z
    .string()
    .optional()
    .describe('Output filename. Written under the configured output directory (basename only).'),
  tag: z.string().optional().describe('Label for logging and analytics (max 30 chars).'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Conversion timeout in milliseconds.'),
  sandbox: z
    .boolean()
    .optional()
    .describe(
      'Override the server default for this call. Sandbox output is watermarked and rate-limited (about 5 requests/sec).'
    ),
  advanced: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Raw fields deep-merged into the request body for any API option not exposed here (e.g. pdf.watermark, pdf.pdfa, pdf.ua, render, request).'
    ),
  returnBase64: z
    .boolean()
    .optional()
    .describe('Also return the file as base64 in structured output (heavy; for clients without a filesystem).'),
}

export const pdfOptionsSchema = z
  .object({
    format: z.enum(PAGE_FORMATS).optional(),
    landscape: z.boolean().optional(),
    printBackground: z.boolean().optional(),
    outline: z.boolean().optional().describe('Generate PDF bookmarks from HTML headings.'),
    tagged: z.boolean().optional().describe('Produce a tagged (accessible) PDF.'),
    scale: z.number().min(0.1).max(2).optional(),
    pageRanges: z.string().optional().describe('e.g. "1-5, 8, 11-13".'),
    marginTop: z.string().optional().describe('e.g. "10mm".'),
    marginRight: z.string().optional(),
    marginBottom: z.string().optional(),
    marginLeft: z.string().optional(),
  })
  .optional()
  .describe('Page layout options.')

export const screenshotOptionsSchema = z
  .object({
    imageType: z.enum(IMAGE_TYPES).optional().describe('Image format (default png).'),
    fullPage: z.boolean().optional().describe('Capture the full scrollable page.'),
    quality: z.number().min(0).max(100).optional().describe('JPEG/WebP compression quality.'),
    viewportWidth: z.number().int().positive().optional(),
    viewportHeight: z.number().int().positive().optional(),
    devicePixelRatio: z.number().min(0).max(10).optional().describe('Retina / hi-DPI factor.'),
  })
  .optional()
  .describe('Screenshot capture options.')

const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  postalCode: z.string(),
  countryCode: z.string().describe('ISO 3166-1 alpha-2, e.g. DE.'),
})

const partySchema = z.object({
  name: z.string(),
  address: addressSchema,
  taxId: z
    .string()
    .optional()
    .describe('VAT ID. Required for the seller when a line uses VAT category S.'),
  email: z.string().optional(),
  phone: z.string().optional(),
})

const invoiceLineSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitCode: z.string().optional(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  vatRate: z.number().optional(),
  vatCategoryCode: z.string().optional().describe('e.g. "S" for standard rate.'),
})

const taxSummarySchema = z.object({
  categoryCode: z.string(),
  rate: z.number(),
  taxableAmount: z.number(),
  taxAmount: z.number(),
})

const paymentMeansSchema = z.object({
  typeCode: z.string(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  accountName: z.string().optional(),
  paymentReference: z.string().optional(),
})

export const invoiceSchema = z
  .object({
    number: z.string(),
    issueDate: z.string().describe('ISO date, YYYY-MM-DD.'),
    dueDate: z
      .string()
      .optional()
      .describe('ISO date. EN 16931 needs dueDate or paymentTerms (rule BR-CO-25).'),
    currencyCode: z.string().describe('ISO 4217, 3 letters, e.g. EUR.'),
    seller: partySchema,
    buyer: partySchema,
    lines: z.array(invoiceLineSchema).min(1),
    taxSummary: z
      .array(taxSummarySchema)
      .optional()
      .describe('Recommended: VAT breakdown so totals validate.'),
    paymentTerms: z.string().optional(),
    paymentMeans: paymentMeansSchema.optional(),
    totalNetAmount: z.number(),
    totalTaxAmount: z.number(),
    totalGrossAmount: z.number().describe('Must equal totalNetAmount + totalTaxAmount.'),
    note: z.string().optional(),
    buyerReference: z.string().optional(),
  })
  .describe('Structured invoice data embedded as ZUGFeRD / Factur-X XML.')

/** Structured output returned by the three conversion tools. */
export const conversionOutputShape = {
  delivery: z.enum(['download', 'cloudStorage', 'webhook']),
  sandbox: z.boolean(),
  filePath: z.string().optional().describe('Absolute path of the written file (download).'),
  url: z.string().optional().describe('Delivery URL (cloudStorage / webhook).'),
  sizeBytes: z.number().optional(),
  contentType: z.string().optional(),
  conversionId: z.string().optional(),
  creditUsed: z.string().optional(),
  base64: z.string().optional(),
}

export const pdfInputShape = {
  ...sourceShape,
  pdfOptions: pdfOptionsSchema,
  ...deliveryShape,
  ...commonExtrasShape,
}

export const screenshotInputShape = {
  ...sourceShape,
  screenshotOptions: screenshotOptionsSchema,
  ...deliveryShape,
  ...commonExtrasShape,
}

export const einvoiceInputShape = {
  ...sourceShape,
  standard: z.enum(EINVOICE_STANDARDS).default('zugferd'),
  profile: z.enum(EINVOICE_PROFILES).default('en16931'),
  verify: z
    .boolean()
    .optional()
    .describe('Verify PDF/A-3 and e-invoice compliance; fails the request if invalid.'),
  invoice: invoiceSchema,
  ...deliveryShape,
  ...commonExtrasShape,
}

/** Flattened union of every field the three conversion tools may pass. */
export interface ConversionInput {
  url?: string
  html?: string
  templateId?: string
  templateData?: Record<string, unknown>
  filename?: string
  tag?: string
  timeout?: number
  sandbox?: boolean
  advanced?: Record<string, unknown>
  returnBase64?: boolean
  delivery?: 'download' | 'cloudStorage' | 'webhook'
  presignedUrl?: string
  webhook?: Record<string, unknown>
  pdfOptions?: Record<string, unknown>
  screenshotOptions?: Record<string, unknown>
  standard?: 'zugferd' | 'facturx'
  profile?: string
  verify?: boolean
  invoice?: Record<string, unknown>
}
