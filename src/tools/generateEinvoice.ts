import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  einvoiceInputShape,
  conversionOutputShape,
  type ConversionInput,
} from '../schema.js'
import { runConversion, type ConversionDeps } from './shared.js'

const description = [
  'Generate an EU electronic invoice as a hybrid PDF/A-3 (ZUGFeRD or Factur-X): a human-readable PDF with embedded structured invoice XML.',
  'Provide the visible document via one source (html, templateId, or url) and the structured data via the invoice object.',
  'For EN 16931 (profile en16931), include a dueDate or paymentTerms (rule BR-CO-25), a seller taxId when a line uses VAT category S, a taxSummary, and totals where totalNetAmount + totalTaxAmount = totalGrossAmount.',
].join(' ')

export function registerGenerateEinvoice(server: McpServer, deps: ConversionDeps): void {
  server.registerTool(
    'polydoc_generate_einvoice',
    {
      title: 'PolyDoc: Generate E-Invoice',
      description,
      inputSchema: einvoiceInputShape,
      outputSchema: conversionOutputShape,
      annotations: {
        title: 'PolyDoc: Generate E-Invoice',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => runConversion('einvoice', args as ConversionInput, deps)
  )
}
