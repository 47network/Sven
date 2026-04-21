## 2026-04-20 - Fix N+1 queries in KnowledgeGraphService
**Learning:** Using `for` loops with independent `pool.query` inserts creates a massive N+1 bottleneck during high-volume node/relation/evidence storage operations.
**Action:** Replace looped `INSERT` queries with bulk parameterized insertions (e.g., `VALUES ($1, $2), ($3, $4)`) and flattened arrays to optimize PostgreSQL insert speeds. When using `ON CONFLICT DO UPDATE` in batched queries, use the `EXCLUDED` keyword to correctly merge or update records based on the newly inserted batch values.
