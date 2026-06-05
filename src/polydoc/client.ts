import type { PolyDocRequest } from './buildRequestBody.js'
import { extractApiErrorMessage, PolyDocApiError } from './errors.js'

export interface ConvertOptions {
  apiKey: string
  baseUrl: string
  sandbox: boolean
}

export interface BinaryResult {
  kind: 'binary'
  bytes: Uint8Array
  contentType: string
  contentDisposition?: string
  conversionId?: string
  creditUsed?: string
}

export interface JsonResult {
  kind: 'json'
  json: unknown
  conversionId?: string
  creditUsed?: string
}

export type ConvertResult = BinaryResult | JsonResult

export type ConvertFn = (
  request: PolyDocRequest,
  opts: ConvertOptions
) => Promise<ConvertResult>

/**
 * Perform an authenticated PolyDoc API call. Sets the Bearer auth and per-request
 * X-Sandbox header, then branches on the response content-type: JSON for
 * cloud-storage / webhook / base64 delivery, raw bytes for a binary download.
 * Throws PolyDocApiError on any non-2xx response.
 */
export const convert: ConvertFn = async (request, opts) => {
  const res = await fetch(`${opts.baseUrl}${request.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
      'X-Sandbox': opts.sandbox ? 'true' : 'false',
    },
    body: JSON.stringify(request.body),
  })

  const conversionId = res.headers.get('x-conversion-id') ?? undefined
  const creditUsed = res.headers.get('x-credit-used') ?? undefined
  const contentType = res.headers.get('content-type') ?? ''

  if (!res.ok) {
    const raw = await res.text()
    const message =
      extractApiErrorMessage(raw) ?? `PolyDoc request failed with status ${res.status}`
    let body: unknown = raw
    try {
      body = JSON.parse(raw)
    } catch {
      // leave body as the raw string
    }
    throw new PolyDocApiError(res.status, message, body)
  }

  if (contentType.includes('application/json')) {
    return { kind: 'json', json: await res.json(), conversionId, creditUsed }
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  return {
    kind: 'binary',
    bytes,
    contentType,
    contentDisposition: res.headers.get('content-disposition') ?? undefined,
    conversionId,
    creditUsed,
  }
}
