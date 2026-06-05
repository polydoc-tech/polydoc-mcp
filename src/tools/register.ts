import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ConversionDeps } from './shared.js'
import { registerHtmlToPdf } from './htmlToPdf.js'
import { registerScreenshot } from './screenshot.js'
import { registerGenerateEinvoice } from './generateEinvoice.js'
import { registerTestCredentials } from './testCredentials.js'

/** Register every PolyDoc tool on the server with the given dependencies. */
export function registerAllTools(server: McpServer, deps: ConversionDeps): void {
  registerHtmlToPdf(server, deps)
  registerScreenshot(server, deps)
  registerGenerateEinvoice(server, deps)
  registerTestCredentials(server, deps)
}
