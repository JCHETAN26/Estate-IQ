# EstateIQ

AI-powered real estate underwriting platform. Paste a Zillow URL, get mortgage analysis, rental cash flow projections, cap rate analysis, Airbnb profitability estimates, investment risk scoring, and an AI-generated investment memo.

> Build status: Phase 0 complete (monorepo scaffold + CI + review standards). See [`build-plan.md`](./build-plan.md) for the sequenced roadmap.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Language:** TypeScript (strict)
- **Backend:** Node 20 + MCP server (Phase 1)
- **Frontend:** Next.js 15 + Tailwind + shadcn/ui (Phase 4)
- **Database:** PostgreSQL 16 + Prisma (Phase 1)
- **AI:** OpenAI (Phase 3)
- **Data:** Zillow parser + RentCast / ATTOM (Phase 1–2)

## Layout

```
apps/
  web/                # Next.js investor dashboard
  api/                # MCP server + backend orchestration
packages/
  shared/             # Zod schemas + types
  analysis-engine/    # Financial underwriting logic
  ui/                 # Shared UI components
infra/
  docker/             # Container definitions (Phase 5)
  scripts/            # Operational scripts
.github/              # CI workflows + PR template + review standards
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+ (Phase 1)
- Docker Desktop (Phase 5)

## Getting Started

```bash
pnpm install
pnpm dev          # runs every app's dev script in parallel
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

Phase 0 ships a health-check API on port 4000 and a placeholder Next.js page on port 3000 to prove workspace wiring.

```bash
curl http://localhost:4000/health
```

## Environment

Copy `.env.example` to `.env.local` and populate as you progress through phases.

```env
DATABASE_URL=
OPENAI_API_KEY=
RENTCAST_API_KEY=
ATTOM_API_KEY=
```

## Contributing

Read [`.github/CODE_REVIEW.md`](.github/CODE_REVIEW.md) before opening a PR. One task per PR, CI must be green, review checklist must be walked.

## Documents

- [`build-plan.md`](./build-plan.md) — sequenced execution roadmap
- [`.github/CODE_REVIEW.md`](.github/CODE_REVIEW.md) — review standards
- `README.md` (this file) — product scope (full version lands with product spec)
