---
name: content-generator
description: Multi-format marketing content creation pipeline for 47Network — blog posts, social media, newsletters, product announcements, video scripts, and case studies. Includes brief generation, content analysis, word count validation, readability scoring, and content calendar planning.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["create_brief","analyze","calendar"],"default":"create_brief"},"content_type":{"type":"string","enum":["blog_post","social_post","newsletter","product_announcement","video_script","case_study","documentation"]},"channel":{"type":"string","enum":["blog","twitter","linkedin","reddit","email","youtube","tiktok","docs"]},"title":{"type":"string"},"body":{"type":"string"},"start_date":{"type":"string"},"weeks":{"type":"number"},"channels":{"type":"array","items":{"type":"string"}},"key_points":{"type":"array","items":{"type":"string"}},"keywords":{"type":"array","items":{"type":"string"}}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Content Generator Skill

Multi-format content pipeline for 47Network marketing. Generates content briefs, analyzes drafted content for quality and readability, and plans content calendars across channels.

## Actions

- `create_brief` — Generate a structured content brief
- `analyze` — Analyze drafted content for quality and readability
- `calendar` — Generate a multi-channel content calendar
