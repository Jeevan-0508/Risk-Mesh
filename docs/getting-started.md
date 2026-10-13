# Getting started

## Install and validate

```bash
bun install
bun test
bun run typecheck
```

The repository is a TypeScript contract and adapter layer plus a static Observatory. The browser Observatory is already assembled under `observatory/`; the generated briefing state is kept in `data/briefing-state.json`.

## Build the briefing

```bash
npm run briefing:build
npm run briefing:test
```

The briefing builder reads the repository’s captured adapter outputs and writes the generated state consumed by the Observatory. Review the resulting diff before committing it.

## Open the Observatory locally

Serve the repository root with a static server and open `/observatory/`. The page is a visual snapshot of the latest completed checks; it is not a browser-side live connection to every upstream system.
