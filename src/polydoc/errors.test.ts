import { describe, expect, it } from 'vitest'
import { extractApiErrorMessage, PolyDocApiError, UserInputError } from './errors.js'

describe('extractApiErrorMessage', () => {
  it('returns a plain message field', () => {
    expect(extractApiErrorMessage({ success: false, message: 'Too many requests.' })).toBe(
      'Too many requests.'
    )
  })

  it('falls back to the error field', () => {
    expect(extractApiErrorMessage({ error: 'Bad Request' })).toBe('Bad Request')
  })

  it('parses a JSON string body', () => {
    expect(extractApiErrorMessage('{"message":"boom"}')).toBe('boom')
  })

  it('returns a non-JSON string as-is', () => {
    expect(extractApiErrorMessage('plain text error')).toBe('plain text error')
  })

  it('reads violations from bytes', () => {
    const bytes = Buffer.from(JSON.stringify({ message: 'nope' }))
    expect(extractApiErrorMessage(new Uint8Array(bytes))).toBe('nope')
  })

  it('surfaces nested e-invoice violations from docproc.detail', () => {
    const body = {
      success: false,
      message: '{"error":"EN16931 validation failed"}',
      error: 'Unprocessable Entity',
      docproc: {
        detail: {
          error: 'EN16931 validation failed',
          violations: [
            { id: 'BR-CO-25', severity: 'fatal', message: '[BR-CO-25] dueDate or paymentTerms required.' },
          ],
        },
      },
    }
    expect(extractApiErrorMessage(body)).toBe('[BR-CO-25] dueDate or paymentTerms required.')
  })

  it('digs violations out of a JSON-encoded message when there is no docproc', () => {
    const body = {
      message: JSON.stringify({
        error: 'EN16931 validation failed',
        violations: [{ id: 'BR-01', message: 'missing field' }],
      }),
    }
    expect(extractApiErrorMessage(body)).toBe('missing field')
  })

  it('returns undefined for an unrecognized payload', () => {
    expect(extractApiErrorMessage(42)).toBeUndefined()
  })
})

describe('error classes', () => {
  it('PolyDocApiError carries status and body', () => {
    const err = new PolyDocApiError(429, 'rate limited', { retryAfter: 1 })
    expect(err.status).toBe(429)
    expect(err.message).toBe('rate limited')
    expect(err.body).toEqual({ retryAfter: 1 })
    expect(err).toBeInstanceOf(Error)
  })

  it('UserInputError is an Error', () => {
    expect(new UserInputError('bad')).toBeInstanceOf(Error)
  })
})
