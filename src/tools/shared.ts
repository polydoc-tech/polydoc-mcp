import path from 'node:path'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  buildRequestBody,
  defaultFilename,
  type PolyDocOperation,
  type PolyDocParams,
} from '../polydoc/buildRequestBody.js'
import type { ConvertFn, ConvertResult } from '../polydoc/client.js'
import type { Config } from '../polydoc/config.js'
import { PolyDocApiError, UserInputError } from '../polydoc/errors.js'
import { SCREENSHOT_INLINE_MAX_BYTES, type WriteFileFn } from '../polydoc/output.js'
import type { ConversionInput } from '../schema.js'

export interface ConversionDeps {
  config: Config
  convert: ConvertFn
  writeFile: WriteFileFn
}

function asBag(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Map a validated tool input into the framework-agnostic builder params. */
export function inputToParams(
  operation: PolyDocOperation,
  input: ConversionInput
): PolyDocParams {
  const sources = [
    nonEmpty(input.url) ? 'url' : null,
    nonEmpty(input.html) ? 'html' : null,
    nonEmpty(input.templateId) ? 'template' : null,
  ].filter(Boolean) as Array<'url' | 'html' | 'template'>

  if (sources.length !== 1) {
    throw new UserInputError('Provide exactly one of url, html, or templateId.')
  }
  const sourceType = sources[0]

  const mode = input.delivery ?? 'download'
  if (mode === 'cloudStorage' && !nonEmpty(input.presignedUrl)) {
    throw new UserInputError('cloudStorage delivery requires presignedUrl.')
  }
  if (mode === 'webhook' && !nonEmpty(asBag(input.webhook)?.url)) {
    throw new UserInputError('webhook delivery requires a webhook object with a url.')
  }

  const params: PolyDocParams = {
    operation,
    sourceType,
    url: input.url,
    html: input.html,
    templateId: input.templateId,
    templateData: asBag(input.templateData),
    filename: input.filename,
    tag: input.tag,
    timeout: input.timeout,
    advanced: asBag(input.advanced),
    delivery: {
      mode,
      presignedUrl: input.presignedUrl,
      webhook: asBag(input.webhook),
    },
  }

  if (operation === 'pdf') params.pdfOptions = asBag(input.pdfOptions)
  if (operation === 'screenshot') params.screenshotOptions = asBag(input.screenshotOptions)
  if (operation === 'einvoice') {
    params.eInvoiceStandard = input.standard ?? 'zugferd'
    params.eInvoiceProfile = input.profile ?? 'en16931'
    params.eInvoiceVerify = input.verify
    params.invoice = asBag(input.invoice)
  }

  return params
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

function deliveredUrl(json: unknown): string | undefined {
  const data = asBag(asBag(json)?.data)
  return nonEmpty(data?.url) ? (data!.url as string) : undefined
}

function jsonDelivery(
  operation: PolyDocOperation,
  mode: 'cloudStorage' | 'webhook',
  result: Extract<ConvertResult, { kind: 'json' }>,
  sandbox: boolean
): CallToolResult {
  const url = deliveredUrl(result.json)
  const summary =
    `PolyDoc ${operation} delivered via ${mode}.` + (url ? ` URL: ${url}` : '')
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'text', text: JSON.stringify(result.json, null, 2) },
    ],
    structuredContent: {
      delivery: mode,
      sandbox,
      url,
      conversionId: result.conversionId,
      creditUsed: result.creditUsed,
    },
  }
}

/**
 * Run one conversion end to end and shape the MCP result: download writes a file
 * and returns its path plus metadata (screenshots also return an inline image);
 * cloud/webhook return the delivery URL. API and input errors come back as
 * isError so the model can self-correct; only unexpected faults propagate.
 */
export async function runConversion(
  operation: PolyDocOperation,
  input: ConversionInput,
  deps: ConversionDeps
): Promise<CallToolResult> {
  try {
    const params = inputToParams(operation, input)
    const sandbox = input.sandbox ?? deps.config.sandbox
    const request = buildRequestBody(params)
    const result = await deps.convert(request, {
      apiKey: deps.config.apiKey,
      baseUrl: deps.config.baseUrl,
      sandbox,
    })

    if (result.kind === 'json') {
      const mode = params.delivery.mode === 'webhook' ? 'webhook' : 'cloudStorage'
      return jsonDelivery(operation, mode, result, sandbox)
    }

    const imageType = asBag(input.screenshotOptions)?.imageType as string | undefined
    const name = path.basename((input.filename ?? '').trim() || defaultFilename(operation, imageType))
    const filePath = await deps.writeFile(deps.config.outputDir, name, result.bytes)
    const base64 = Buffer.from(result.bytes).toString('base64')

    const summary =
      `PolyDoc ${operation} complete. Saved to ${filePath} ` +
      `(${result.bytes.length} bytes, ${result.contentType}).` +
      (sandbox ? ' Sandbox output is watermarked.' : '')
    const content: CallToolResult['content'] = [{ type: 'text', text: summary }]

    if (operation === 'screenshot') {
      if (result.bytes.length <= SCREENSHOT_INLINE_MAX_BYTES) {
        content.push({ type: 'image', data: base64, mimeType: result.contentType })
      } else {
        content.push({
          type: 'text',
          text: 'Screenshot too large to inline; see the saved file. Use a smaller viewport or jpeg for an inline preview.',
        })
      }
    }

    return {
      content,
      structuredContent: {
        delivery: 'download',
        sandbox,
        filePath,
        sizeBytes: result.bytes.length,
        contentType: result.contentType,
        conversionId: result.conversionId,
        creditUsed: result.creditUsed,
        ...(input.returnBase64 ? { base64 } : {}),
      },
    }
  } catch (err) {
    if (err instanceof UserInputError) return errorResult(err.message)
    if (err instanceof PolyDocApiError) {
      return errorResult(`PolyDoc API error ${err.status}: ${err.message}`)
    }
    throw err
  }
}

export interface TestCredentialsResult {
  ok: boolean
  status: number
  message: string
}

/**
 * The playbook's mandatory credential test: a minimal screenshot forced to
 * sandbox so it never draws production quota. Reports validity rather than
 * throwing, so an invalid key is a normal (non-error) result.
 */
export async function runTestCredentials(deps: ConversionDeps): Promise<CallToolResult> {
  const request = buildRequestBody({
    operation: 'screenshot',
    sourceType: 'html',
    html: '<p>polydoc</p>',
    screenshotOptions: { imageType: 'png' },
    delivery: { mode: 'download' },
  })

  const reply = (r: TestCredentialsResult): CallToolResult => ({
    content: [{ type: 'text', text: r.message }],
    structuredContent: { ...r },
  })

  try {
    await deps.convert(request, {
      apiKey: deps.config.apiKey,
      baseUrl: deps.config.baseUrl,
      sandbox: true,
    })
    return reply({ ok: true, status: 200, message: 'PolyDoc credentials valid; the API key was accepted.' })
  } catch (err) {
    if (err instanceof PolyDocApiError) {
      const message =
        err.status === 401
          ? 'PolyDoc API key rejected (401). Check the key set in POLYDOC_API_KEY.'
          : `Credential check failed (${err.status}): ${err.message}`
      return reply({ ok: false, status: err.status, message })
    }
    throw err
  }
}
