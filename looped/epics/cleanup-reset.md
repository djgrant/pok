---
title: Cleanup Reset
created: "2026-02-22"
updated: "2026-02-22"
owner: human
status: active
---
## At a Glance
Reset `pok` for predictable automation by tightening command contracts, release safety, and integration confidence.

## Problem
Contract inconsistency in core tooling propagates friction into every dependent repo and agent workflow.

## Outcome
- Command behavior is consistent and documented.
- RC publish flow is reliable under normal failure modes.
- Integrations have explicit, tested expectations.

## Plan
1. Normalize command contract behavior.
Align args, errors, and JSON outputs across core commands.
2. Harden release workflow.
Make prepatch/publish steps deterministic with clear rollback paths.
3. Clarify extension boundaries.
Define stable extension points and lifecycle expectations.
4. Increase integration confidence.
Add smoke coverage for real `looped` and `smithers` usage.
5. Remove maintenance drag.
Trim obsolete paths and consolidate shared utilities.

## Subtasks
- Standardize command interfaces and output contracts.
- Harden RC publish workflow and rollback guidance.
- Document extension boundaries and invariants.
- Add cross-repo smoke tests for critical paths.
- Remove dead code and align common helpers.
