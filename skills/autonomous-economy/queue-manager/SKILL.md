---
name: queue-manager
description: Queue lifecycle and visibility management
version: 1.0.0
price: 11.99
currency: USD
archetype: engineer
tags: [messaging, streaming, queue-manager]
---
# queue manager
Queue lifecycle and visibility management with intelligent automation.
## Actions
### configure
Set up queue manager configuration.
- **inputs**: configParams, options
- **outputs**: configId, status
### execute
Execute primary queue manager operation.
- **inputs**: configId, parameters
- **outputs**: result, details
### analyze
Analyze queue manager throughput and health.
- **inputs**: configId, since, metrics
- **outputs**: analysis, recommendations
### export-report
Export queue manager report.
- **inputs**: configId, format, period
- **outputs**: report, summary
### list-history
List operation history.
- **inputs**: configId, since, limit
- **outputs**: operations[], total
### optimize
Optimize queue manager performance.
- **inputs**: configId, strategy
- **outputs**: optimizations[], applied
