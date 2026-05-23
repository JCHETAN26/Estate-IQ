# EstateIQ Code Review Standards

This document defines the engineering review workflow for EstateIQ. Every pull request is reviewed against these standards before merge.

## Review Workflow

1. Author opens a PR using the repository template.
2. CI must be green: `lint`, `typecheck`, `build`, `test`.
3. At least one reviewer approves.
4. Reviewer walks the [Review Checklist](#review-checklist) below.
5. Author addresses comments. Reviewer re-approves.
6. PR is merged with a linear history (no merge commits, rebase or squash).

## Authoring Standards

### Naming

- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- Types and interfaces: `PascalCase`. Prefer `type` over `interface` unless declaration merging is needed.
- Variables and functions: `camelCase`. Booleans read as questions: `isReady`, `hasMemo`.
- Constants: `SCREAMING_SNAKE_CASE` only for true compile-time constants.
- Zod schemas: suffix `Schema` (e.g. `PropertySchema`). Inferred type takes the unsuffixed name.

### Architecture Rules

- One responsibility per module. If a file holds two unrelated exports, split it.
- Pure financial logic lives in `packages/analysis-engine`. It must not import from `apps/api` or `apps/web`.
- Cross-cutting Zod schemas and types live in `packages/shared`. Never re-declare a shared shape inside an app.
- MCP tools (`apps/api/src/mcp/`) must be independently callable. A tool may not import another tool's internals.
- API route handlers stay thin: parse input → call a service → format output. Business logic lives in services.
- Frontend components stay presentational where possible. Data fetching is colocated in hooks or server components.

### API Validation Requirements

- Every external input crosses a Zod boundary: HTTP request body, query params, third-party API responses, MCP tool arguments, environment variables.
- Validation errors return structured 4xx responses, never 500s.
- Never trust upstream APIs. Parse their responses with Zod before persisting or returning them.

### Type Safety

- No `any`. ESLint enforces this.
- Prefer `unknown` plus a narrowing check over `any`.
- Avoid non-null assertions (`!`). If a value can be undefined, handle it.
- Use `as const` and discriminated unions instead of magic strings.

### Forbidden Patterns

- `any` types. Use `unknown`, generics, or proper types.
- Hardcoded secrets, API keys, or connection strings. Read from env, validated at startup.
- Inline AI prompts. Prompts live in dedicated files under `apps/api/src/ai/prompts/` (Phase 3).
- Console-driven debugging committed to main. Use the structured logger.
- Calling external APIs from React components. Fetching belongs in server components, route handlers, or hooks.
- Duplicated business logic. If you copy-paste, extract.

## Review Checklist

Reviewers walk this list and the author confirms each item before requesting review.

### Correctness

- [ ] No duplicated business logic
- [ ] Zod validation added where input crosses a boundary
- [ ] Edge cases covered (empty input, missing fields, network failure)
- [ ] Errors handled and surfaced meaningfully

### UX (frontend changes)

- [ ] Loading states present
- [ ] Error states present
- [ ] Empty states present
- [ ] Mobile responsiveness checked at 375px width
- [ ] Keyboard navigation works for interactive elements

### Security

- [ ] No hardcoded secrets
- [ ] User input is validated and escaped
- [ ] No new dependencies on unmaintained or unfamiliar packages
- [ ] Auth and authorization checks unchanged or strengthened

### AI Code (Phase 3+)

- [ ] AI prompts externalized to dedicated files
- [ ] Outputs grounded in computed metrics (no hallucinated numbers)
- [ ] Failure modes handled (rate limit, timeout, malformed JSON)

### Tests

- [ ] Tests added for new logic where applicable
- [ ] Existing tests still pass
- [ ] No skipped or disabled tests without justification

### Repository Hygiene

- [ ] One task per PR
- [ ] PR title concise and under 70 characters
- [ ] No `node_modules`, build outputs, or `.env` files committed
- [ ] No commented-out code blocks left behind

## Disagreements

Disagreements escalate to a second reviewer. Final tiebreaker: alignment with `README.md` (product) and `system-prompt.md` (engineering principles). If those documents conflict, `README.md` wins.
