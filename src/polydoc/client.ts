import type { PolyDocRequest } from './buildRequestBody.js'
import { extractApiErrorMessage, PolyDocApiError, PolyDocTimeoutError } from './errors.js'

/**
 * Hard ceiling for a single API request. The gateway caps a conversion at 10
 * minutes and holds the connection open until it resolves, so 15 minutes clears
 * any legitimate slow render plus queue and network overhead. Its only job is to
 * break a dead or stalled connection that would otherwise hang the client forever.
 */
export const REQUEST_TIMEOUT_MS = 900_000

export interface ConvertOptions {
  apiKey: string
  baseUrl: string
  sandbox: boolean
  /** Abort the request after this many ms with no response. Defaults to REQUEST_TIMEOUT_MS. */
  timeoutMs?: number
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
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS
  try {
    const res = await fetch(`${opts.baseUrl}${request.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
        'X-Sandbox': opts.sandbox ? 'true' : 'false',
      },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(timeoutMs),
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
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new PolyDocTimeoutError(timeoutMs)
    }
    throw err
  }
}
