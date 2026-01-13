# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **pnpm monorepo** using **Turborepo** with two main applications:
- **apps/web**: AdonisJS v6 backend with React 19 frontend (SSR via Inertia.js)
- **apps/mobile**: Expo 54 + React Native 0.81 mobile app

Shared packages in `packages/`:
- `eslint-config`: Shared ESLint configurations
- `typescript-config`: Shared TypeScript configurations
- `ui`: Shared React UI components (Radix UI, Tailwind)

## Essential Commands

```bash
# Install dependencies (required: pnpm 10.18.0+, Node >= 20)
pnpm install

# Development (all apps with HMR)
pnpm dev

# Build all apps
pnpm build

# Lint and format
pnpm lint
pnpm format
pnpm typecheck

# App-specific commands
pnpm --filter web run dev          # AdonisJS dev server with HMR
pnpm --filter web run build        # Build AdonisJS app
pnpm --filter web run test         # Run tests (Japa framework)
pnpm --filter mobile run start     # Expo dev server
pnpm --filter mobile run lint      # Lint mobile app
```

## Architecture

### apps/web (AdonisJS)

**Path aliases** (use these in imports):
```
#core/*      → ./app/core/
#auth/*      → ./app/auth/
#users/*     → ./app/users/
#marketing/* → ./app/marketing/
#config/*    → ./config/
```

**Key directories:**
- `app/` - Controllers, models, middleware organized by domain
- `start/` - Route definitions and bootstrap
- `config/` - AdonisJS configuration
- `resources/` - Inertia views (React components)

**Frontend path alias:** `~/` maps to `app/core/ui/`

### apps/mobile (Expo)

**Path alias:** `@/*` maps to `./*`

**Key patterns:**
- Expo Router file-based routing in `app/`
- `lib/tuyau.ts` - Type-safe API client connecting to AdonisJS
- HeroUI Native for UI components
- Tailwind CSS via Uniwind

### Cross-app Communication

Uses **Tuyau** for type-safe API calls between mobile and web:
- Web exports API types via `@tuyau/core`
- Mobile consumes via `@tuyau/client`

## Git Workflow & Hooks

**Branches:**
- `main` - Production (auto-deploys to Railway)
- `dev` - Development
- `feature/*`, `fix/*` - Working branches

**Husky hooks are configured:**
- **Pre-commit**: Runs `lint-staged` (ESLint + Prettier on staged files)
- **Pre-push**: Runs build and tests for apps/web

## Deployment

Railway deployment configured in `railway.toml`:
- Builds only `apps/web`
- Health check endpoint: `/health`
- Runs migrations and seeds on deploy

**Environment variables** for production CORS:
- `VITE_APP_URL` - Comma-separated allowed origins

## Important Notes

1. **Mobile apps don't send Origin header** - CORS config returns `true` for requests without origin
2. **React 19** is overridden globally via pnpm overrides
3. **Turborepo caching** - Clean with `turbo clean` if stale builds
4. **ESLint import resolution** - Use relative paths in mobile app, TypeScript path aliases may not resolve in ESLint without extra config