import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { convert } from './client.js'
import type { PolyDocRequest } from './buildRequestBody.js'
import { PolyDocApiError, PolyDocTimeoutError } from './errors.js'

let server: http.Server | undefined

afterEach(async () => {
  if (server) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = undefined
  }
})

function listen(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler)
  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const { port } = server!.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

const request: PolyDocRequest = { endpoint: '/pdf/convert', body: { source: {} }, isBinary: true }

describe('convert timeout', () => {
  it('throws PolyDocTimeoutError when the server never responds', async () => {
    // Accept the connection but never write a response, so only the client
    // timeout can end the request.
    const baseUrl = await listen(() => {})

    await expect(
      convert(request, { apiKey: 'k', baseUrl, sandbox: false, timeoutMs: 50 })
    ).rejects.toBeInstanceOf(PolyDocTimeoutError)
  })

  it('does not fire when the server responds in time', async () => {
    const baseUrl = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: { url: 'https://cdn.example/out.pdf' } }))
    })

    const result = await convert(request, {
      apiKey: 'k',
      baseUrl,
      sandbox: false,
      timeoutMs: 5_000,
    })

    expect(result.kind).toBe('json')
  })

  it('still surfaces a non-2xx as PolyDocApiError, not a timeout', async () => {
    const baseUrl = await listen((_req, res) => {
      res.writeHead(422, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'nope' }))
    })

    await expect(
      convert(request, { apiKey: 'k', baseUrl, sandbox: false, timeoutMs: 5_000 })
    ).rejects.toBeInstanceOf(PolyDocApiError)
  })
})
