# EstateIQ — Build Plan

> A concrete, sequenced plan for the builder LLM. Read alongside `README.md` (product specification) and `system-prompt.md` (engineering principles).
>
> **The README defines the product. This document defines execution. The system prompt defines engineering behavior.**

---

# How to Use This Document

1. Work tasks in strict sequence. Do not skip phases.
2. One Pull Request per task.
3. Every task requires:

   * green CI
   * peer/self code review
   * screenshots or terminal proof
4. Stop immediately if product behavior becomes ambiguous.
5. Do not add “nice-to-have” features outside scope.

---

# Source of Truth

| File                        | Responsibility                                  |
| --------------------------- | ----------------------------------------------- |
| `README.md`                 | Product scope, UX expectations, non-negotiables |
| `system-prompt.md`          | Engineering principles and coding behavior      |
| `build-plan.md`             | Sequenced implementation roadmap                |
| `apps/api/`                 | MCP + backend orchestration services            |
| `apps/web/`                 | Next.js investor dashboard                      |
| `packages/analysis-engine/` | Financial modeling and underwriting logic       |
| `packages/shared/`          | Shared schemas, types, validators               |

> If documents conflict, `README.md` wins.

---

# Product Goal

EstateIQ is an AI-powered real estate underwriting platform powered by MCP.

The system allows users to:

* paste a Zillow listing URL
* instantly receive:

  * mortgage analysis
  * rental cash flow projections
  * cap rate analysis
  * Airbnb profitability estimates
  * investment risk scoring
  * AI-generated investment memos

The product should feel like:

> “An AI investment analyst for real estate.”

NOT:

> “A property calculator.”

---

# Engineering Constraints

* TypeScript-first architecture
* Strict type safety
* No `any`
* Zod validation everywhere
* Server-first architecture
* Minimal infrastructure complexity for MVP
* MCP tools must remain modular and independently callable

---

# Pre-flight Checklist

* [ ] Node.js 20+
* [ ] pnpm 9+
* [ ] PostgreSQL 16+
* [ ] Docker Desktop installed
* [ ] OpenAI API key configured
* [ ] Zillow/RentCast API access prepared
* [ ] GitHub branch protections enabled

Populate `.env.local`:

```env
DATABASE_URL=...
OPENAI_API_KEY=...
RENTCAST_API_KEY=...
ATTOM_API_KEY=...
```

Verify:

```bash
node --version
pnpm --version
docker --version
```

---

# Phase 0 — Monorepo Foundation & Engineering Guardrails

**Window:** Day 1
**Goal:** Establish production-grade repository structure, CI/CD, and development standards.

---

## Task 0.1 — Monorepo Initialization

### Deliverable

A structured Turborepo monorepo with isolated applications and packages.

### Steps

Initialize repository structure:

```txt
apps/
  web/                # Next.js frontend
  api/                # MCP server + backend APIs

packages/
  shared/             # Shared Zod schemas and TS types
  analysis-engine/    # Financial calculations
  ui/                 # Shared UI components

infra/
  docker/
  scripts/

.github/
```

Install:

* Turborepo
* TypeScript
* ESLint
* Prettier
* Husky
* lint-staged

Configure:

* strict TypeScript
* path aliases
* shared ESLint configs

### Acceptance

* `pnpm dev` runs successfully.
* Shared package imports work across apps.
* Type-checking passes without warnings.

---

## Task 0.2 — CI/CD & Branch Protections

### Deliverable

Automated GitHub Actions validation pipeline.

### Steps

Create:
`.github/workflows/ci.yml`

Pipeline jobs:

* lint
* typecheck
* build
* test

Enforce:

* branch protection
* required PR reviews
* linear history

### Acceptance

* Broken PRs fail automatically.
* Direct pushes to `main` blocked.
* CI runtime under 6 minutes.

---

## Task 0.3 — Code Review Standards

### Deliverable

A documented engineering review workflow.

### Steps

Create:

```txt
.github/
  pull_request_template.md
  CODE_REVIEW.md
```

Define:

* naming standards
* architecture rules
* API validation requirements
* forbidden patterns

Required review checklist:

* [ ] no duplicated business logic
* [ ] Zod validation added
* [ ] loading/error states handled
* [ ] mobile responsiveness checked
* [ ] no hardcoded secrets
* [ ] AI prompts externalized
* [ ] tests added where applicable

### Acceptance

* Every PR automatically includes review checklist.
* Repository documents code-review workflow clearly.

---

### ✅ Phase 0 Definition of Done

* Monorepo operational
* CI/CD enforced
* Branch protections active
* Code review standards documented

**STOP. Request review before Phase 1.**

---

# Phase 1 — Database, MCP Core & Property Ingestion

**Window:** Days 2–3
**Goal:** Build the foundational backend infrastructure and MCP architecture.

---

## Task 1.1 — PostgreSQL & Prisma Setup

### Deliverable

Production-ready relational database layer.

### Steps

Install:

* PostgreSQL
* Prisma ORM

Create models:

* Property
* Analysis
* RentalEstimate
* User
* InvestmentMemo

Add:

* migrations
* seed scripts

### Acceptance

* Database migrations succeed cleanly.
* Prisma Studio displays seeded records.

---

## Task 1.2 — MCP Server Foundation

### Deliverable

Modular MCP tool execution framework.

### Steps

Inside:

```txt
apps/api/src/mcp/
```

Create:

* tool registry
* tool executor
* schema validator
* logging middleware

Initial tools:

```txt
parse_listing
estimate_mortgage
calculate_cash_flow
generate_investment_summary
```

### Acceptance

* MCP tools callable independently.
* Invalid payloads rejected via Zod.
* Structured logs generated.

---

## Task 1.3 — Zillow URL Parsing Engine

### Deliverable

Reliable property extraction pipeline.

### Steps

Build:

```txt
listing-parser.service.ts
```

Extract:

* address
* price
* bedrooms
* bathrooms
* sqft
* HOA
* taxes
* property type

Fallback:

* mock parser for failed pages

### Acceptance

* Parser succeeds on at least 20 Zillow URLs.
* Extraction accuracy >90%.

---

## Task 1.4 — Code Review Checkpoint

### Deliverable

Formal review of backend architecture.

### Review Focus

* MCP tool modularity
* validation coverage
* DB schema normalization
* logging quality
* parser reliability

### Acceptance

* No critical review blockers.
* Approved PR merged before Phase 2.

---

### ✅ Phase 1 Definition of Done

* Database operational
* MCP core functional
* Zillow ingestion working

**STOP. Request review before Phase 2.**

---

# Phase 2 — Financial Underwriting Engine

**Window:** Days 4–6
**Goal:** Build real investment analysis logic.

---

## Task 2.1 — Mortgage & Expense Engine

### Deliverable

Accurate property financing calculations.

### Steps

Implement:

* mortgage payments
* PMI
* taxes
* insurance
* HOA
* maintenance
* vacancy reserve

### Output Metrics

```txt
Monthly Payment
Cash Flow
NOI
Cap Rate
Cash-on-Cash Return
```

### Acceptance

* Results validated against online calculators.
* Calculations deterministic.

---

## Task 2.2 — Rental Estimation System

### Deliverable

Rent estimation and comparable analysis.

### Steps

Integrate:

* RentCast API
* rental comp retrieval
* local market averages

Compute:

* estimated rent
* occupancy assumptions
* yield analysis

### Acceptance

* Rental estimates generated successfully.
* Nearby comps displayed.

---

## Task 2.3 — Airbnb Profitability Analyzer

### Deliverable

Short-term rental investment analysis.

### Steps

Estimate:

* ADR
* occupancy
* cleaning costs
* furnishing costs
* seasonality

Generate:

```txt
Projected Annual Revenue
Break-even Timeline
STR Risk Level
```

### Acceptance

* Airbnb projections generated within 5 seconds.
* Risk assumptions clearly documented.

---

## Task 2.4 — Investment Scoring Engine

### Deliverable

AI-friendly underwriting score system.

### Steps

Generate:

```txt
Investment Score (0–100)
```

Factors:

* cash flow
* neighborhood growth
* rent-to-price ratio
* taxes
* appreciation potential

### Acceptance

* Every property receives deterministic scoring.
* Score explanation included.

---

## Task 2.5 — Code Review Checkpoint

### Review Focus

* financial calculation correctness
* edge-case handling
* formula clarity
* duplicated logic
* performance

### Acceptance

* Review approved before Phase 3.

---

### ✅ Phase 2 Definition of Done

* Full underwriting engine operational.
* Property analysis produces realistic outputs.

**STOP. Request review before Phase 3.**

---

# Phase 3 — AI Intelligence Layer

**Window:** Days 7–8
**Goal:** Transform raw calculations into investment reasoning.

---

## Task 3.1 — AI Memo Generation

### Deliverable

LLM-generated investment thesis.

### Steps

Build:

```txt
memo-generator.service.ts
```

Generate:

* strengths
* risks
* negotiation insights
* investment recommendation

### Constraints

* grounded only on computed metrics
* no hallucinated numbers
* structured markdown output

### Acceptance

* Memo references actual metrics correctly.
* Tone resembles professional analyst report.

---

## Task 3.2 — Conversational Agent Layer

### Deliverable

Natural-language investment interaction.

### Steps

Implement:

* chat endpoint
* memory context
* MCP orchestration

Example prompts:

* “Would this cash flow?”
* “Compare this to nearby rentals.”
* “What risks should I consider?”

### Acceptance

* Agent successfully invokes MCP tools dynamically.
* Context persists across conversation.

---

## Task 3.3 — Risk Analysis Layer

### Deliverable

Structured investment risk categorization.

### Categories

```txt
Low Risk
Moderate Risk
High Risk
```

Factors:

* crime
* taxes
* insurance volatility
* vacancy
* regulation exposure

### Acceptance

* Risk explanations deterministic and explainable.

---

## Task 3.4 — Code Review Checkpoint

### Review Focus

* prompt engineering quality
* hallucination prevention
* tool orchestration reliability
* response consistency

### Acceptance

* No hallucinated calculations.
* Review approved before Phase 4.

---

### ✅ Phase 3 Definition of Done

* AI reasoning layer operational.
* End-to-end underwriting flow functional.

**STOP. Request review before Phase 4.**

---

# Phase 4 — Next.js Frontend & UX

**Window:** Days 9–11
**Goal:** Build polished investor-facing UI.

---

## Task 4.1 — Dashboard UI Foundation

### Deliverable

Modern responsive frontend.

### Stack

* Next.js 15
* Tailwind
* shadcn/ui
* React Query

### Pages

```txt
/
 /analyze
 /property/[id]
```

### Acceptance

* Mobile responsive.
* Lighthouse performance >90.

---

## Task 4.2 — Property Analysis Dashboard

### Deliverable

Interactive underwriting interface.

### Sections

* property overview
* financial metrics
* cash flow charts
* investment score
* AI memo
* risk analysis

### Acceptance

* Dashboard loads within 3 seconds.
* Charts update dynamically.

---

## Task 4.3 — “What If” Investment Simulator

### Deliverable

Interactive financing adjustments.

### User Controls

* down payment
* interest rate
* rent
* occupancy

### Acceptance

* Metrics recalculate instantly.
* No UI lag.

---

## Task 4.4 — Code Review Checkpoint

### Review Focus

* accessibility
* loading states
* responsiveness
* component reuse
* frontend performance

### Acceptance

* UI approved before Phase 5.

---

### ✅ Phase 4 Definition of Done

* Production-quality frontend operational.

**STOP. Request review before Phase 5.**

---

# Phase 5 — Deployment, Observability & Demo Readiness

**Window:** Days 12–14
**Goal:** Deploy MVP and finalize investor demo flow.

---

## Task 5.1 — Docker & Deployment

### Deliverable

Containerized production deployment.

### Deploy

* Vercel (frontend)
* Railway/Render/Fly.io (backend)
* Supabase/Postgres

### Acceptance

* Production environment stable.
* HTTPS operational.

---

## Task 5.2 — Observability & Analytics

### Deliverable

Operational monitoring stack.

### Add

* Sentry
* PostHog
* request logging
* latency tracking

### Acceptance

* Errors visible in dashboard.
* Slow endpoints tracked.

---

## Task 5.3 — Demo Flow & Final Validation

### Deliverable

Fully polished demo scenario.

### Demo Script

1. Paste Zillow URL
2. Generate underwriting analysis
3. Show AI memo
4. Run “what-if” simulation
5. Compare two properties

### Acceptance

* Full flow completes under 15 seconds.
* No visible runtime errors.

---

## Task 5.4 — Final Code Review & Release

### Deliverable

Production readiness review.

### Review Areas

* architecture quality
* security
* scalability
* code cleanliness
* documentation
* API contracts

### Acceptance

* Repository tagged `v1.0.0`
* README finalized
* Demo recorded

---

### ✅ Phase 5 Definition of Done

* EstateIQ deployed publicly.
* MVP stable and demo-ready.

---

# Out of Scope for MVP

The following are intentionally excluded:

* MLS integrations
* automated property purchasing
* multi-user collaboration
* native mobile apps
* advanced ML forecasting
* autonomous acquisition agents
* portfolio optimization engines
* banking integrations
* legal/title workflows

---

# Quick Reference — Phase Summary

| Phase | Window     | Focus                             | Gate                       |
| ----- | ---------- | --------------------------------- | -------------------------- |
| 0     | Day 1      | Monorepo, CI/CD, review workflows | Green CI                   |
| 1     | Days 2–3   | MCP core, DB, Zillow parsing      | Property ingestion works   |
| 2     | Days 4–6   | Underwriting engine               | Financial metrics accurate |
| 3     | Days 7–8   | AI reasoning layer                | Agent outputs valid memos  |
| 4     | Days 9–11  | Frontend dashboard                | Responsive production UI   |
| 5     | Days 12–14 | Deployment + demo                 | Public MVP live            |
