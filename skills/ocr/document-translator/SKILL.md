---
name: document-translator
description: Works with the document pipeline to produce translated summaries and translated OCR output.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [translate_summary, detect_language]
    content:
      type: string
    target_language:
      type: string
    style:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# document-translator

Translates document summaries and OCR text between languages. Integrates with model-router for optimal translation model selection. Supports all GLM-OCR detected languages.
