/**
 * Pure assembly of the PolyDoc request body from resolved tool params. No I/O and
 * no MCP references, so it is unit-testable in isolation and stays the single
 * source of truth for the request shape across all tools. Ported from the n8n
 * connector's GenericFunctions.buildRequestBody (the framework-agnostic asset the
 * connector playbook is built around).
 */

export type PolyDocOperation = 'pdf' | 'screenshot' | 'einvoice'
export type PolyDocSourceType = 'url' | 'html' | 'template'
export type PolyDocDeliveryMode = 'download' | 'cloudStorage' | 'webhook'

export const PDF_CONVERT_PATH = '/pdf/convert'
export const SCREENSHOT_CONVERT_PATH = '/screenshot/convert'

type Bag = Record<string, unknown>

export interface PolyDocParams {
  operation: PolyDocOperation
  sourceType: PolyDocSourceType
  url?: string
  html?: string
  templateId?: string
  templateData?: Bag
  filename?: string
  tag?: string
  timeout?: number
  /** PDF option bag: format, landscape, printBackground, scale, pageRanges, outline, tagged, margin*, pdfa, pdfua */
  pdfOptions?: Bag
  /** Screenshot option bag: imageType, fullPage, quality, encoding, viewport{Width,Height}, devicePixelRatio */
  screenshotOptions?: Bag
  eInvoiceStandard?: 'facturx' | 'zugferd'
  eInvoiceProfile?: string
  eInvoiceVerify?: boolean
  invoice?: Bag
  /** Raw object deep-merged into the request body for any field not surfaced as a control. */
  advanced?: Bag
  delivery: {
    mode: PolyDocDeliveryMode
    presignedUrl?: string
    webhook?: Bag
  }
}

export interface PolyDocRequest {
  endpoint: typeof PDF_CONVERT_PATH | typeof SCREENSHOT_CONVERT_PATH
  body: Bag
  isBinary: boolean
}

function isPlainObject(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Deep-merge `source` into `target` (source wins). Arrays and scalars overwrite. */
export function mergeDeep(target: Bag, source: Bag): Bag {
  const out: Bag = { ...target }
  for (const [key, value] of Object.entries(source)) {
    // The advanced JSON is user-supplied; skip prototype-pollution keys.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeDeep(out[key] as Bag, value)
    } else {
      out[key] = value
    }
  }
  return out
}

function resolveSource(params: PolyDocParams): string {
  switch (params.sourceType) {
    case 'url':
      return params.url ?? ''
    case 'html':
      return params.html ?? ''
    case 'template':
      return `[template:${params.templateId ?? ''}]`
    default:
      return ''
  }
}

function buildLayout(opts: Bag): Bag | undefined {
  const layout: Bag = {}
  if (typeof opts.format === 'string' && opts.format !== '') layout.format = opts.format
  for (const flag of ['landscape', 'printBackground', 'outline', 'tagged'] as const) {
    if (typeof opts[flag] === 'boolean') layout[flag] = opts[flag]
  }
  if (typeof opts.scale === 'number') layout.scale = opts.scale
  if (typeof opts.pageRanges === 'string' && opts.pageRanges !== '')
    layout.pageRanges = opts.pageRanges

  const margins = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const
  if (margins.some((m) => opts[m] !== undefined && opts[m] !== '')) {
    layout.margin = {
      top: opts.marginTop ?? '0',
      right: opts.marginRight ?? '0',
      bottom: opts.marginBottom ?? '0',
      left: opts.marginLeft ?? '0',
    }
  }
  return Object.keys(layout).length > 0 ? layout : undefined
}

/** Conformance targets live under `pdf`, not `layout`. */
function buildPdfConformance(opts: Bag): Bag | undefined {
  const pdf: Bag = {}
  for (const target of ['pdfa', 'pdfua'] as const) {
    if (isPlainObject(opts[target])) pdf[target] = opts[target]
  }
  return Object.keys(pdf).length > 0 ? pdf : undefined
}

function buildScreenshot(opts: Bag): Bag | undefined {
  const shot: Bag = {}
  if (typeof opts.imageType === 'string' && opts.imageType !== '') shot.type = opts.imageType
  if (typeof opts.fullPage === 'boolean') shot.fullPage = opts.fullPage
  if (typeof opts.quality === 'number') shot.quality = opts.quality
  if (opts.encoding === 'base64') shot.encoding = 'base64'
  if (typeof opts.viewportWidth === 'number' && typeof opts.viewportHeight === 'number') {
    const viewport: Bag = { width: opts.viewportWidth, height: opts.viewportHeight }
    if (typeof opts.devicePixelRatio === 'number' && opts.devicePixelRatio > 0)
      viewport.devicePixelRatio = opts.devicePixelRatio
    shot.viewport = viewport
  }
  return Object.keys(shot).length > 0 ? shot : undefined
}

/**
 * Assemble the PolyDoc request body. Returns the endpoint to call, the body to
 * send, and whether the default (binary) delivery is in effect.
 */
export function buildRequestBody(params: PolyDocParams): PolyDocRequest {
  const endpoint =
    params.operation === 'screenshot' ? SCREENSHOT_CONVERT_PATH : PDF_CONVERT_PATH
  const body: Bag = { source: resolveSource(params) }

  if (params.templateData && Object.keys(params.templateData).length > 0)
    body.templateData = params.templateData
  if (params.filename) body.filename = params.filename
  if (params.tag) body.tag = params.tag
  if (typeof params.timeout === 'number' && params.timeout > 0) body.timeout = params.timeout

  if (params.operation === 'pdf') {
    const layout = params.pdfOptions ? buildLayout(params.pdfOptions) : undefined
    if (layout) body.layout = layout
    const pdf = params.pdfOptions ? buildPdfConformance(params.pdfOptions) : undefined
    if (pdf) body.pdf = pdf
  }

  if (params.operation === 'screenshot') {
    const shot = params.screenshotOptions ? buildScreenshot(params.screenshotOptions) : undefined
    if (shot) body.screenshot = shot
  }

  if (params.operation === 'einvoice') {
    const eInvoice: Bag = {
      standard: params.eInvoiceStandard,
      profile: params.eInvoiceProfile,
      invoice: params.invoice ?? {},
    }
    if (typeof params.eInvoiceVerify === 'boolean') eInvoice.verify = params.eInvoiceVerify
    body.eInvoice = eInvoice
  }

  const isBinary = params.delivery.mode === 'download'
  if (params.delivery.mode === 'cloudStorage' && params.delivery.presignedUrl) {
    body.cloudStorage = { presignedUrl: params.delivery.presignedUrl }
  }
  if (params.delivery.mode === 'webhook' && params.delivery.webhook) {
    body.webhook = params.delivery.webhook
  }

  const merged =
    params.advanced && Object.keys(params.advanced).length > 0
      ? mergeDeep(body, params.advanced)
      : body

  return { endpoint, body: merged, isBinary }
}

/** Default output filename when the caller did not set one. */
export function defaultFilename(operation: PolyDocOperation, imageType?: string): string {
  if (operation === 'screenshot') {
    const ext = imageType === 'jpeg' ? 'jpg' : (imageType ?? 'png')
    return `screenshot.${ext}`
  }
  return 'document.pdf'
}
