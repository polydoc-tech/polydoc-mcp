import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { runTestCredentials, type ConversionDeps } from './shared.js'

const testCredentialsOutputShape = {
  ok: z.boolean(),
  status: z.number(),
  message: z.string(),
}

export function registerTestCredentials(server: McpServer, deps: ConversionDeps): void {
  server.registerTool(
    'polydoc_test_credentials',
    {
      title: 'PolyDoc: Test Credentials',
      description:
        'Verify the configured PolyDoc API key by running a minimal sandbox render. Reports whether the key is accepted; never draws production quota.',
      inputSchema: {},
      outputSchema: testCredentialsOutputShape,
      annotations: {
        title: 'PolyDoc: Test Credentials',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => runTestCredentials(deps)
  )
}
