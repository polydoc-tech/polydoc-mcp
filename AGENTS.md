# Agent rules for the PolyDoc connectors and tools

<!--
The same file, byte for byte, in every polydoc-tech repo. To change it, edit the copy in
polydoc-tech/.github and copy it over the others in the same pass.
-->

This repo is one of the public polydoc-tech repos that put the PolyDoc API (PDF, screenshot and
e-invoice generation) in front of users: the MCP server, the connectors for automation
platforms, and the shared configuration in `polydoc-tech/.github` and
`polydoc-tech/renovate-config`. These rules bind every change in any of them, whoever or
whatever makes it.

## Claim only what is true today

- A README, a store or marketplace listing, a dropdown label, a field hint, a tool
  description, a sample response, an error message, and PR and commit text all describe the
  product. Each one says only what the code and the API do now.
- The API reference, https://docs.polydoc.tech/api-reference/, is the source for endpoints,
  fields, allowed values, limits and error codes. Read a value there before adding, removing or
  renaming it. Do not type one from memory.

## Never

- **Put a value into an e-invoice that the source system does not hold.** A connector passes
  on what the flow, the app or the caller gave it. When a field the format requires is
  missing, name the missing field and stop, or ask the user for it. Do not fill it so that
  validation passes: no default name, code or identifier, no value worked out from other
  fields, no rounding of an amount the source holds. Each is allowed only where the format's
  official specification prescribes that value or that calculation, and the code names the
  clause where it applies it. The same holds for text a repo hands to a model, such as the MCP
  server's tool descriptions: they tell the model to ask the user for missing invoice data, not
  to make it up.
- **Commit an internal file, a local path or a private link.** These repos are public. The
  guard workflow's `content` job fails a pull request that adds one; see the README of
  `polydoc-tech/.github`.
- **Commit a credential**, even a sandbox key. The guard's `secrets` job scans the full
  history, and a key that reached history counts as leaked even after a later commit removes
  it.

## Every pull request

- A new direct dependency needs a `New-Dependency: <name> <reason>` line in the pull request
  body. A source change that adds or changes no test needs a `No-Test: <reason>` line. The
  guard checks both.
- In a repo with a version, a version change adds a `## X.Y.Z - YYYY-MM-DD` heading to
  `CHANGELOG.md` in the same pull request. CI checks that the heading exists for the version
  in the manifest. A release is a `vX.Y.Z` tag on `main`.
