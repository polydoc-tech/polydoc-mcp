# Changelog

This file starts at 0.1.10. The changes of earlier versions are in the git history between
the version tags (https://github.com/polydoc-tech/polydoc-mcp/tags). 0.1.0 is on npm without
a tag. Dates are the npm publish date, in UTC.

## 0.1.10 - 2026-11-03

- `polydoc_generate_einvoice` accepts `typeCode` (BT-3), `precedingInvoiceReference`
  (BG-3) and `salesOrderReference` (BT-14), so a credit note or a corrected invoice can name
  the invoice it refers to.
