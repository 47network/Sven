---
name: code-screenshot-reader
description: Extracts code from screenshots using OCR with code-aware detection and syntax preservation.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [extract_code]
    content:
      type: string
    language:
      type: string
  required: [action, content]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# code-screenshot-reader

Extracts code from screenshots with syntax-aware OCR. Preserves indentation, detects programming language, and outputs clean, copy-pasteable code blocks.
