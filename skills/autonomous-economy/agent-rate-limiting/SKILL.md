---
skill: agent-rate-limiting
name: Agent Rate Limiting & Throttling
version: 1.0.0
description: Enforce fair usage quotas, manage burst capacity, and protect platform resources from overuse
category: platform
tags: [rate-limit, throttling, quota, fairness, capacity]
autonomous: true
economy:
  pricing: included
  base_cost: 0
---

# Agent Rate Limiting & Throttling

Protect platform services with configurable rate limits, burst handling,
quota management, and throttle strategies per agent and resource type.

## Actions

### policy_create
Create a new rate limit policy for a resource type.
- **Inputs**: policyName, resourceType, maxRequests, windowSeconds, burstLimit?, throttleStrategy?
- **Outputs**: policyId, enabled, created

### policy_update
Update an existing rate limit policy.
- **Inputs**: policyId, maxRequests?, windowSeconds?, burstLimit?, enabled?
- **Outputs**: policyId, updated

### override_grant
Grant a rate limit override to a specific agent.
- **Inputs**: policyId, agentId, overrideType, maxRequests?, reason?, expiresAt?
- **Outputs**: overrideId, active, grantedBy

### quota_allocate
Allocate a usage quota to an agent for a resource.
- **Inputs**: agentId, resourceType, allocated, periodStart, periodEnd, autoRenew?
- **Outputs**: quotaId, allocated, remaining

### counter_check
Check current rate limit counter for an agent/policy.
- **Inputs**: policyId, agentId
- **Outputs**: requestCount, withinLimit, retryAfter?

### throttle_status
Get throttle status and recent events for an agent.
- **Inputs**: agentId, resourceType?
- **Outputs**: status, recentEvents[], activePolicies[]

### quota_report
Generate quota usage report for an agent or globally.
- **Inputs**: agentId?, resourceType?, periodStart?, periodEnd?
- **Outputs**: allocations[], usagePercent, overages[]
