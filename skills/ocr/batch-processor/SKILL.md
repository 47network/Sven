---
name: batch-processor
description: Processes multiple documents through the OCR pipeline in batch with progress tracking.
version: 0.1.0
publisher: 47network
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [process_batch]
    documents:
      type: array
    extract_entities:
      type: boolean
    summarize:
      type: boolean
    pii_safe:
      type: boolean
  required: [action, documents]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# batch-processor

Processes multiple documents through the full OCR and entity-extraction pipeline in a single batch. Tracks progress and returns aggregate results.
