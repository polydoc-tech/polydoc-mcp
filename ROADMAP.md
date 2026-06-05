# polydoc-mcp roadmap

PolyDoc connector for the Model Context Protocol, built per
`../../CONNECTOR-PLAYBOOK.md` and mirroring the n8n reference
(`../../n8n-nodes-polydoc`) and the pipedream sibling (`../pipedream-polydoc`).
Fresh standalone repo at `~/Projects/polydoc/tools/polydoc-mcp/`.

Status legend: done · in progress · todo

---

## 0. Decision record (why this shape)

MCP is a new connector platform the playbook predates. The same product model
applies (2 endpoints, 3 operations, the API-key + sandbox + base-URL credential,
the mandatory credential test, source modes, delivery options, the Advanced-JSON
escape hatch), mapped onto MCP primitives.

**Three tools, not one `operation` dropdown.** The playbook's "converge the
product, never ship three separate nodes" rule is about *human* builder UX, where
a dropdown is more discoverable than three search results. An MCP tool is selected
by an LLM reading `name` + `description` + JSON schema, and one wide tool with an
`operation` enum forces conditional field validity (screenshot fields meaningless
for e-invoice, `invoice` meaningless for a screenshot) that JSON Schema expresses
poorly and models misfill. Three narrow tools each describe a coherent operation
with no dead fields. Convergence still holds at the package and credential level
(one server, one key), and this matches the pipedream sibling's per-operation
actions. A fourth tool, `polydoc_test_credentials`, is the MCP analog of the
playbook's mandatory credential test.

**Binary output writes to disk.** MCP tool results are content blocks, not file
downloads. A download is written into `POLYDOC_OUTPUT_DIR` (a path-jailed root)
and the absolute path plus metadata is returned; screenshots additionally return
an inline image block so the model can see the result. cloudStorage / webhook
delivery returns the URL or ack. `returnBase64` is an opt-in for clients without
a filesystem.

**Runtime deps are fine here.** The playbook's zero-runtime-deps rule is an n8n
*verification* gate; it does not apply to MCP. This server depends on
`@modelcontextprotocol/sdk` and `zod` (the SDK 1.x supports zod 3 and 4).

### Three angle-split assets (analog of the n8n template trio)

The three operations are the angle split. Worked example inputs live in
`examples/` (branded PDF from template, URL screenshot, ZUGFeRD/EN-16931
e-invoice), the direct analog of the n8n connector's three template JSONs.

---

## 1. Passes

### Pass 1 - shared core (done)
- done `git init`, package.json (MIT, name `polydoc-mcp`), tsconfig (NodeNext ESM),
  vitest, prettier, eslint, .gitignore, LICENSE.
- done `src/polydoc/buildRequestBody.ts` - pure port of the n8n builder + helpers;
  unit tests ported 1:1 from the n8n suite, green.
- done `client.ts` (fetch wrapper, X-Sandbox per request, binary vs JSON),
  `errors.ts` (PolyDocApiError + violation-aware message extraction),
  `config.ts` (env, fail-fast), `output.ts` (write jail) + jail tests.

### Pass 2 - tools + server (done)
- done `schema.ts` zod fragments (source / delivery / extras / pdf / screenshot /
  invoice) + per-tool input shapes + structured output shape.
- done Four tool files + `register.ts` + `index.ts` stdio bootstrap (stderr-only
  logging, fail-fast on missing key).
- done Handler tests (param mapping, file write, image block, error envelope,
  sandbox override, delivery modes), an in-memory MCP round-trip per concern, and
  path-escape tests. Honest annotations + outputSchema per tool.

### Pass 3 - live + polish (done)
- done Live sandbox smoke tests (gated on `POLYDOC_API_KEY`, spaced for the
  ~5/sec cap) through `client.convert`; all four operations verified.
- done Manual stdio run verified end to end (PDF + PNG written, screenshot inline
  image, e-invoice 422 surfaces the BR-CO-25 violation cleanly).
- done README with client-config snippets, three angle-split examples, .env.example,
  em-dash scrub, eslint, release.yml authored.

### Pass 4 - publish (in progress)
- done Create `polydoc-tech/polydoc-mcp` on GitHub (`gh`), push `main` (public,
  matching the n8n sibling).
- done First manual `npm publish` of `polydoc-mcp@0.1.0` under the `polydoc.tech`
  account; verified installable (`npm i polydoc-mcp` links the `polydoc-mcp` bin
  and the server reports ready on stdio).
- todo Configure npm Trusted Publishing on npmjs.com for `release.yml` (GitHub
  Actions, org `polydoc-tech`, repo `polydoc-mcp`, workflow `release.yml`, npm
  >= 11.5.1). Until then do not push a `v*.*.*` tag: the authored workflow would
  run without OIDC configured and fail. After it is set up, release via
  `npm version patch && git push --follow-tags`.

---

## 2. Open questions / known unknowns

- MCP **resource** exposing the e-invoice field reference + a worked invoice
  example: highest-value optional addition; deferred. The example is currently
  baked into the tool description and `examples/`.
- MCP **prompts** (one per angle): only worth it if a target client surfaces them;
  deferred.
- Streamable-HTTP transport (remote use) in addition to stdio: deferred; stdio
  covers the local-client case.
- MCP registry / client directory submission once published.
- Docs guide entry and recording MCP gotchas in `CONNECTOR-PLAYBOOK.md`.
