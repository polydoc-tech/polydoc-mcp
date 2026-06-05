import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { pdfInputShape, conversionOutputShape, type ConversionInput } from '../schema.js'
import { runConversion, type ConversionDeps } from './shared.js'

const description = [
  'Convert a web page, inline HTML, or a saved PolyDoc template to a PDF.',
  'Provide exactly one source: url, html, or templateId (with optional templateData).',
  'By default the PDF is written to the configured output directory and the file path is returned.',
  'Note: HTML that loads scripts from a CDN can hang the renderer; prefer self-contained HTML.',
].join(' ')

export function registerHtmlToPdf(server: McpServer, deps: ConversionDeps): void {
  server.registerTool(
    'polydoc_html_to_pdf',
    {
      title: 'PolyDoc: HTML/URL to PDF',
      description,
      inputSchema: pdfInputShape,
      outputSchema: conversionOutputShape,
      annotations: {
        title: 'PolyDoc: HTML/URL to PDF',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => runConversion('pdf', args as ConversionInput, deps)
  )
}
