import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerAllTools } from './tools/register.js'
import { writeBinaryFile } from './polydoc/output.js'
import type { ConvertFn } from './polydoc/client.js'
import type { Config } from './polydoc/config.js'

// A full MCP round-trip through the real SDK over an in-memory transport: this
// exercises schema registration, zod input validation, and the
// content/structuredContent (incl. output-schema) envelope, no network needed.

let outputDir: string

beforeEach(async () => {
  outputDir = await mkdtemp(path.join(os.tmpdir(), 'polydoc-mcp-server-'))
})

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true })
})

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
const fakeConvert: ConvertFn = async (request) => ({
  kind: 'binary',
  bytes: request.endpoint.includes('screenshot')
    ? new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    : pdfBytes,
  contentType: request.endpoint.includes('screenshot') ? 'image/png' : 'application/pdf',
  conversionId: 'conv-rt',
  creditUsed: '1',
})

async function connect(convert: ConvertFn = fakeConvert): Promise<Client> {
  const server = new McpServer({ name: 'polydoc-mcp', version: 'test' })
  const config: Config = {
    apiKey: 'k',
    baseUrl: 'https://api.example',
    sandbox: false,
    outputDir,
  }
  registerAllTools(server, { config, convert, writeFile: writeBinaryFile })

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: 'test' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

describe('PolyDoc MCP server (in-memory round-trip)', () => {
  it('advertises the four tools', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'polydoc_generate_einvoice',
      'polydoc_html_to_pdf',
      'polydoc_screenshot',
      'polydoc_test_credentials',
    ])
    await client.close()
  })

  it('runs html_to_pdf and returns a jailed file path', async () => {
    const client = await connect()
    const res = await client.callTool({
      name: 'polydoc_html_to_pdf',
      arguments: { html: '<h1>round trip</h1>', filename: 'rt.pdf' },
    })
    expect(res.isError).toBeFalsy()
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.delivery).toBe('download')
    expect(sc.filePath).toBe(path.join(outputDir, 'rt.pdf'))
    await client.close()
  })

  it('rejects input that violates the schema', async () => {
    const client = await connect()
    const res = await client.callTool({
      name: 'polydoc_html_to_pdf',
      arguments: { url: 'https://x', timeout: -1 },
    })
    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ type: string; text?: string }>)
      .map((c) => c.text ?? '')
      .join(' ')
    expect(text).toMatch(/validation|too small|invalid/i)
    await client.close()
  })

  it('runs test_credentials and reports ok', async () => {
    const client = await connect()
    const res = await client.callTool({ name: 'polydoc_test_credentials', arguments: {} })
    const sc = res.structuredContent as Record<string, unknown>
    expect(sc.ok).toBe(true)
    expect(sc.status).toBe(200)
    await client.close()
  })
})
