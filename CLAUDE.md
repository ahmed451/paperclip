# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Paperclip is an open-source platform for orchestrating autonomous AI companies — agents collaborate on tasks inside a structured company hierarchy. This fork adds a layer for employees to monitor/track agents status. The employees workspace serve as a portal for users to follow-up with the agents. This is a TypeScript monorepo managed with pnpm workspaces.

## Commands

```bash
# Development
pnpm dev              # Start full dev environment with file watching
pnpm dev:once         # Single run (used in CI / one-shot contexts)
pnpm dev:server       # Server only (port 3100)
pnpm dev:ui           # UI only (port 5173)

# Building
pnpm build            # Compile all packages
pnpm typecheck        # Type-check entire workspace

# Testing
pnpm test             # Run Vitest unit tests
pnpm test:watch       # Vitest in watch mode
pnpm test:e2e         # Playwright end-to-end tests
pnpm test:smoke       # Release smoke tests

# Database
pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply pending migrations

# Storybook
pnpm storybook        # Component library (port 6006)
```

Run a single test file: `pnpm vitest run path/to/file.test.ts`

## Architecture

```
/server          Express REST API (port 3100), business logic and DB access
/ui              React 19 + Vite + Tailwind CSS frontend (port 5173)
/cli             Bootstrap CLI for install and management
/packages/
  db/            Drizzle ORM schema, migrations, embedded PostgreSQL client
  shared/        Zod schemas and types shared between server and UI
  adapter-utils/ Common infrastructure for adapters
  mcp-server/    Model Context Protocol wrapper over the REST API
  plugins/       Plugin SDK, examples, and create-paperclip-plugin scaffolder
  adapters/      LLM/agent runtime integrations (claude-local, codex-local, cursor-local, etc.)
/doc/            Architecture docs — DEVELOPING.md, DATABASE.md, DEPLOYMENT-MODES.md
/scripts/        Release, smoke, and build utilities
/tests/          E2E (Playwright) and release smoke tests
```

**Server layout:** routes in `server/src/routes/*.ts` (one file per entity: agents, issues, companies, etc.), services in `server/src/services/*.ts`.

**UI layout:** pages in `ui/src/pages/*.tsx` (route-based), reusable components in `ui/src/components/`.

**Shared types:** defined as Zod schemas in `packages/shared`, consumed by both server and UI.

## Key Conventions

**Database:** Schema lives in `packages/db/src/schema.ts`. Migrations are numbered sequentially in `packages/db/src/migrations/` — run `db:generate` after schema changes, never hand-edit migration files. `PAPERCLIP_MIGRATION_AUTO_APPLY=true` triggers auto-migration on `dev:once`.

**Testing:** Unit tests colocate with source (`.test.ts`). Vitest is configured at root with per-workspace project references. New features require tests.

**TypeScript:** Strict mode (`tsconfig.base.json`). All workspace packages extend the base config. Zod validates data at system boundaries (API inputs, adapter outputs).

**Adapters:** Each adapter in `packages/adapters/` wraps a different LLM runtime. They hot-reload via file watching in dev. See `adapter-plugin.md` for authoring.

**Plugins:** Plugin SDK is public API (`packages/plugins/plugin-sdk`). Plugins follow the scaffold convention from `create-paperclip-plugin`.

## Contributing Requirements (from CONTRIBUTING.md)

PRs must include a "thinking path" — trace from domain observation → root cause → fix. Greptile automated review must score 5/5. Specify the AI model used. New features require a Discord discussion first. All CI checks must be green.

## Environment

Copy `.env.example` to `.env`. Key variables: `DATABASE_URL`, `PORT`, `BETTER_AUTH_SECRET`. The embedded PostgreSQL starts automatically — no external database needed for local dev.
