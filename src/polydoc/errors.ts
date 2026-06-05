/** Raised when a tool argument is invalid before any API call is attempted. */
export class UserInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserInputError'
  }
}

/** Raised when the PolyDoc API returns a non-2xx response. */
export class PolyDocApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'PolyDocApiError'
    this.status = status
    this.body = body
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Join the messages of a `violations` array found at `obj` or `obj.detail`. */
function collectViolations(obj: Record<string, unknown>): string | undefined {
  const holder = isPlainObject(obj.detail) ? obj.detail : obj
  const violations = (holder as Record<string, unknown>).violations
  if (!Array.isArray(violations) || violations.length === 0) return undefined
  const messages = violations
    .map((v) => (isPlainObject(v) ? ((v.message as string) ?? (v.id as string)) : undefined))
    .filter((m): m is string => typeof m === 'string' && m.length > 0)
  return messages.length > 0 ? messages.join('; ') : undefined
}

/**
 * Best-effort extraction of a human-readable message from a PolyDoc error body
 * that may arrive as bytes, a string, or already-parsed JSON. Prefers concrete
 * e-invoice / converter validation violations (which PolyDoc nests under
 * `docproc.detail` or inside a JSON-encoded `message`) so a caller can act on
 * them, and falls back to the top-level `message` / `error`.
 */
export function extractApiErrorMessage(payload: unknown): string | undefined {
  let value: unknown = payload
  if (value instanceof ArrayBuffer) value = Buffer.from(value).toString('utf8')
  if (Buffer.isBuffer(value)) value = value.toString('utf8')
  if (value instanceof Uint8Array) value = Buffer.from(value).toString('utf8')
  if (typeof value === 'string') {
    const text = value
    try {
      value = JSON.parse(text)
    } catch {
      return text || undefined
    }
  }
  if (!isPlainObject(value)) return undefined

  if (isPlainObject(value.docproc)) {
    const fromDocproc = collectViolations(value.docproc)
    if (fromDocproc) return fromDocproc
  }
  const topViolations = collectViolations(value)
  if (topViolations) return topViolations

  const message = (value.message as string) ?? (value.error as string)
  if (typeof message === 'string' && message.trim().startsWith('{')) {
    try {
      const inner = JSON.parse(message)
      if (isPlainObject(inner)) {
        const innerViolations = collectViolations(inner)
        if (innerViolations) return innerViolations
        if (typeof inner.error === 'string') return inner.error
      }
    } catch {
      // fall through to the raw message string
    }
  }
  return typeof message === 'string' ? message : undefined
}
