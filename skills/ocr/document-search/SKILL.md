---
name: document-search
description: Searches across processed documents for keywords, entities, and semantic matches.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [search]
    query:
      type: string
    content:
      type: string
    case_sensitive:
      type: boolean
  required: [action, query, content]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# document-search

Searches across OCR-processed documents for keywords, entities, and patterns. Returns ranked matches with context snippets and confidence scores.
