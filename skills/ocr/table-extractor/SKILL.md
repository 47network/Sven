---
name: table-extractor
description: Detects and extracts tables from documents, outputting structured data or Markdown-formatted tables.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [extract, to_markdown]
    content:
      type: string
    rows:
      type: number
    columns:
      type: number
  required: [action, content]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# table-extractor

Detects and extracts tabular data from documents and images. Outputs structured cell data or Markdown-formatted tables. Handles merged cells, headers, and multi-page tables.
