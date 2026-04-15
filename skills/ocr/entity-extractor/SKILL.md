---
name: entity-extractor
description: Extracts named entities (people, organizations, dates, currency, PII) from document text with optional PII redaction.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [extract, redact]
    content:
      type: string
  required: [action, content]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# entity-extractor

Extracts named entities from OCR-processed or raw text: persons, organisations, locations, dates, currencies, emails, phone numbers, URLs, and ID numbers. Supports PII redaction for compliance.
