---
name: document-reader
description: Extracts text from documents and images using GLM-OCR with multi-language, table, handwriting, math, and code detection.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [read, configure, detect_language]
    content:
      type: string
    mode:
      type: string
      enum: [text, table, handwriting, code, math, mixed]
    language:
      type: string
    output_format:
      type: string
      enum: [text, markdown, json, html]
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# document-reader

Core OCR skill. Reads documents and images using GLM-OCR (0.9B params, <1GB VRAM). Supports multi-language, table, handwriting, math/LaTeX, and code screenshot recognition with confidence scoring.
