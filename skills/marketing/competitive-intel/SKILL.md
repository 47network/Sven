---
name: competitive-intel
description: Automated competitive intelligence engine — tracks competitor websites, job listings, social media, GitHub activity, and press releases. Generates strategic analysis reports with threat assessment and recommended responses for 47Network.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["create_profile","add_signal","weekly_report","threat_matrix"],"default":"weekly_report"},"name":{"type":"string"},"website":{"type":"string"},"competitor_id":{"type":"string"},"signal_type":{"type":"string","enum":["job_listing","website_change","social_post","press_release","github_activity","app_store_update","patent_filing"]},"title":{"type":"string"},"content":{"type":"string"},"source_url":{"type":"string"},"profiles":{"type":"array"},"signals":{"type":"array"},"previous_signals":{"type":"array"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Competitive Intelligence Skill

Automated competitor tracking and strategic analysis for 47Network. Monitors competitor signals across multiple channels, classifies impact, and generates actionable reports.

## Actions

- `create_profile` — Create a new competitor profile to track
- `add_signal` — Log a new competitive signal for a tracked competitor
- `weekly_report` — Generate a weekly competitive intelligence summary
- `threat_matrix` — Build threat assessment matrix across all competitors
