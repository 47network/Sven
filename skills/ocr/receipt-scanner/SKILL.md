---
name: receipt-scanner
description: Extracts vendor, items, totals, tax, and payment information from receipt images and scans.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [scan_receipt]
    content:
      type: string
  required: [action, content]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# receipt-scanner

Specialised receipt/invoice OCR skill. Extracts vendor name, date, line items, subtotal, tax, total, and payment method from receipt images and scans.
