# polydoc-mcp

An [MCP](https://modelcontextprotocol.io) server for [PolyDoc](https://polydoc.tech), a REST API that converts HTML or URLs to **PDF**, captures **screenshots**, and generates EU-compliant **e-invoices** (Factur-X / ZUGFeRD hybrid PDF/A-3). It lets MCP clients (Claude Desktop, Claude Code, Cursor, and others) drive PolyDoc directly.

## Tools

- **`polydoc_html_to_pdf`** - HTML, URL, or saved template to PDF (layout, margins, page format, page ranges, bookmarks, accessible/tagged PDFs).
- **`polydoc_screenshot`** - HTML, URL, or template to PNG / JPEG / WebP, with viewport and device-pixel-ratio control. Returns an inline image preview when small enough.
- **`polydoc_generate_einvoice`** - Factur-X or ZUGFeRD hybrid PDF/A-3 from structured invoice data, profiles from `minimum` to `extended`.
- **`polydoc_test_credentials`** - verify the configured API key with a minimal sandbox render (never draws production quota).

Content can come from a **URL**, an inline **HTML** string, or a saved **template** (with Liquid `templateData`). Downloads are written to a local directory and the file path is returned; you can also deliver to your **cloud storage** (presigned URL) or a **webhook**.

## Installation

Requires Node.js >= 20.15. Published to npm, so clients can run it with `npx`:

```
npx -y polydoc-mcp
```

The server is configured entirely through environment variables (see below).

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `POLYDOC_API_KEY` | yes | - | API key from [dashboard.polydoc.tech](https://dashboard.polydoc.tech). |
| `POLYDOC_SANDBOX` | no | `false` | Default sandbox mode (watermarked, rate-limited). A tool call can override per request. |
| `POLYDOC_BASE_URL` | no | `https://api.polydoc.tech` | Override for self-hosted or staging. |
| `POLYDOC_OUTPUT_DIR` | no | OS temp dir + `/polydoc` | Where downloads are written. Output never escapes this folder. |

## Client setup

### Claude Desktop

Add to `claude_desktop_config.json` (Settings > Developer > Edit Config):

```json
{
  "mcpServers": {
    "polydoc": {
      "command": "npx",
      "args": ["-y", "polydoc-mcp"],
      "env": {
        "POLYDOC_API_KEY": "your-key",
        "POLYDOC_OUTPUT_DIR": "/Users/you/Documents/polydoc"
      }
    }
  }
}
```

### Claude Code

```
claude mcp add polydoc -e POLYDOC_API_KEY=your-key -- npx -y polydoc-mcp
```

### Cursor

Add to `~/.cursor/mcp.json` (or a project `.cursor/mcp.json`) using the same `mcpServers` block shown for Claude Desktop.

## Output and delivery

- **Download** (default): the file is written under `POLYDOC_OUTPUT_DIR` and the absolute path is returned with metadata (size, conversion id, credits). Screenshots also return an inline image block. Pass `returnBase64: true` to also receive the bytes as base64 (heavy; for clients without a filesystem).
- **Cloud storage**: set `delivery: "cloudStorage"` and `presignedUrl`. The upload URL is returned.
- **Webhook**: set `delivery: "webhook"` and a `webhook` object (`{ url, async?, method?, headers? }`).

## Anything not in a tool's schema?

Every conversion tool has an `advanced` object that is deep-merged into the request body, so any API capability not surfaced as a typed field (for example `pdf.watermark`, `pdf.encryption`, `render`, `request`) is still reachable. See the field reference at [docs.polydoc.tech](https://docs.polydoc.tech).

## Examples

Worked tool inputs for each angle live in [`examples/`](./examples): a branded PDF from a template, a URL screenshot, and a ZUGFeRD / EN 16931 e-invoice.

## Development

- `yarn install`
- `yarn build` - compile to `dist/`
- `yarn lint`
- `yarn test` - unit tests (request builder, output jail, tool handlers) and an in-memory MCP round-trip
- `POLYDOC_API_KEY=your-key yarn test:integration` - live smoke tests against the sandbox
- `yarn scrub:check` - check for em-dashes in source and docs

Run the built server directly for a quick check:

```
POLYDOC_API_KEY=your-key node dist/index.js
```

## License

[MIT](./LICENSE)
