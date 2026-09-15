# Vaynt Forge

**Build. Test. Debug. Understand.**

A professional desktop API engineering workbench — an IDE + API command center.
Not a Postman clone.

## Stack

- **Shell:** Electron (Chromium + Node)
- **Language:** TypeScript (strict)
- **UI:** React + Tailwind CSS + shadcn/ui + Lucide
- **State:** Zustand
- **Network engine:** `undici` / `ws` / `@grpc/grpc-js` (pure TS, shell-agnostic)
- **Storage:** SQLite + Electron `safeStorage`
- **Monorepo:** Turborepo

## Architecture

```
apps/desktop   → Electron shell (main + preload + renderer)
apps/web       → browser fallback (PWA)
packages/engine→ networking, storage, variables, sandbox — pure TypeScript, NO Electron
packages/ui    → shared React components + design tokens
packages/config→ shared tsconfigs
```

The engine never imports Electron; a shell swap is a thin-shell change, not a rewrite.

## Development

```bash
npm install
npm run dev            # desktop electron app (hot reload)
npm run build          # build all workspaces
npm run typecheck      # strict type-check all workspaces
npm run lint           # eslint
```

Only the desktop app:
```bash
npm run dev -w apps/desktop
```

## Roadmap

See [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md) — 14 sprints, sprint-tracked.

## Prototype reference

`VayntForge.html` is the design prototype (interactive single-file bundle) that informs
the UI. It is not shipped.