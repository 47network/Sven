---
name: document-summarizer
description: Generates extractive summaries from documents with configurable style, key point extraction, and document comparison.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [summarize, compare, key_points]
    content:
      type: string
    title:
      type: string
    style:
      type: string
      enum: [executive, detailed, bullet_points, one_liner]
    max_length:
      type: number
    documents:
      type: array
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# document-summarizer

Generates extractive summaries from OCR output or raw text. Supports executive, detailed, bullet-point, and one-liner styles. Can compare multiple documents and extract key points.
