<!--
Thanks for contributing to EstateIQ.
Keep this PR focused on a single task from build-plan.md.
-->

## Summary

<!-- One short paragraph: what changed and why. -->

## Linked Task

<!-- e.g. Phase 1 / Task 1.2 — MCP Server Foundation -->

Phase:
Task:

## Changes

-
-
-

## Verification

<!-- Required: paste terminal output, screenshots, or short repro steps. -->

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (if tests exist for this task)
- [ ] Manual verification documented below

```
<!-- terminal output / repro evidence -->
```

## Code Review Checklist

- [ ] No duplicated business logic
- [ ] Zod validation added where input crosses a boundary
- [ ] Loading and error states handled
- [ ] Mobile responsiveness checked (frontend only)
- [ ] No hardcoded secrets or API keys
- [ ] AI prompts externalized to dedicated files
- [ ] Tests added where applicable
- [ ] No `any` types introduced
- [ ] MCP tools (if any) remain modular and independently callable

## Out of Scope

<!-- Anything intentionally deferred to a later task. -->

## Screenshots / Recording

<!-- For UI changes. Drag images here. -->
