---
title: Pok Contract Hardening
created: "2026-02-22"
updated: "2026-02-22"
owner: human
status: active
---
Pok is reset around one goal: command and release behavior must be predictable for agents and humans.

Success criteria:
- Command contracts are consistent across core commands.
- RC publish flow is deterministic and recoverable.
- Downstream integrations have explicit, tested guarantees.

Execution plan:
1. Normalize argument parsing, errors, and JSON output shape.
2. Harden prepatch/publish workflow and rollback path.
3. Add integration smoke coverage for looped/smithers usage.
4. Remove dead code and align shared utility behavior.

Seed tasks (medium scope):
- Standardize command contract and output envelopes.
- Add release workflow guardrails and failure recovery docs.
- Create integration smoke suite for downstream consumers.
- Consolidate duplicated utility paths in CLI plumbing.
- Cut RC and verify in looped + smithers flows.
