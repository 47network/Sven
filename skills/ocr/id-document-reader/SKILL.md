---
name: id-document-reader
description: Extracts structured fields from identity documents (passports, driver's licenses, national IDs) with PII-safe handling.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [read_id]
    content:
      type: string
    pii_safe:
      type: boolean
  required: [action, content]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# id-document-reader

Extracts structured data from identity documents (passport, driver's license, national ID). Admin-gated access required. PII encrypted at rest, audit-logged, with automatic redaction in PII-safe mode.
