import os from 'node:os'
import path from 'node:path'

export const DEFAULT_BASE_URL = 'https://api.polydoc.tech'

export interface Config {
  apiKey: string
  baseUrl: string
  /** Default sandbox mode; a tool call may override it per request. */
  sandbox: boolean
  /** Absolute directory binary downloads are written into (the write jail root). */
  outputDir: string
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
}

/**
 * Build the typed config from the environment. Throws if POLYDOC_API_KEY is
 * missing so the server can fail fast before connecting the transport.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.POLYDOC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'POLYDOC_API_KEY is required. Set it in the MCP server env (create a key at dashboard.polydoc.tech).'
    )
  }

  const baseUrl = (env.POLYDOC_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const outputDir = path.resolve(
    env.POLYDOC_OUTPUT_DIR?.trim() || path.join(os.tmpdir(), 'polydoc')
  )

  return { apiKey, baseUrl, sandbox: isTruthy(env.POLYDOC_SANDBOX), outputDir }
}
