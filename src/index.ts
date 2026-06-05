#!/usr/bin/env node
// On stdio, stdout carries the JSON-RPC protocol. All diagnostics MUST go to
// stderr; a stray console.log anywhere reachable from the running server
// corrupts the protocol stream.
import { createRequire } from 'node:module'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { convert } from './polydoc/client.js'
import { loadConfig } from './polydoc/config.js'
import { writeBinaryFile } from './polydoc/output.js'
import { registerAllTools } from './tools/register.js'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

async function main(): Promise<void> {
  let config
  try {
    config = loadConfig()
  } catch (err) {
    console.error(`[polydoc-mcp] ${(err as Error).message}`)
    process.exit(1)
  }

  const server = new McpServer({ name: 'polydoc-mcp', version })
  registerAllTools(server, { config, convert, writeFile: writeBinaryFile })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[polydoc-mcp] v${version} ready on stdio (base ${config.baseUrl})`)
}

main().catch((err) => {
  console.error('[polydoc-mcp] fatal:', err)
  process.exit(1)
})
