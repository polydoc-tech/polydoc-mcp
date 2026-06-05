import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  screenshotInputShape,
  conversionOutputShape,
  type ConversionInput,
} from '../schema.js'
import { runConversion, type ConversionDeps } from './shared.js'

const description = [
  'Capture a screenshot of a web page, inline HTML, or a saved PolyDoc template.',
  'Provide exactly one source: url, html, or templateId.',
  'Returns PNG/JPEG/WebP written to the configured output directory, plus an inline image preview when small enough to display.',
].join(' ')

export function registerScreenshot(server: McpServer, deps: ConversionDeps): void {
  server.registerTool(
    'polydoc_screenshot',
    {
      title: 'PolyDoc: Capture Screenshot',
      description,
      inputSchema: screenshotInputShape,
      outputSchema: conversionOutputShape,
      annotations: {
        title: 'PolyDoc: Capture Screenshot',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => runConversion('screenshot', args as ConversionInput, deps)
  )
}
