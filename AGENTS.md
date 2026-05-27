# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js + TypeScript WhatsApp birthday bot. Application code lives in `src/`.
Entry points are `src/index.ts` for the bot and `src/cli/*.ts` for operational commands. Core
logic is in `src/domain/`, persistence is in `src/repositories/` and `src/database/`, adapters are
in `src/integrations/`, scheduling is in `src/scheduler/`, and logging/metrics are in
`src/observability/`. Tests live under `tests/`, split by `unit/`, `integration/`, plus focused
repository and observability suites. SQL migrations are in `migrations/`; operational docs are in
`docs/`. Treat `data/`, `sessions/`, local SQLite files, and `dist/` as generated or runtime data.

## Build, Test, and Development Commands

- `npm run dev`: run the bot locally with `tsx src/index.ts`.
- `npm run build`: compile TypeScript into `dist/`.
- `npm start`: run the compiled app from `dist/index.js`.
- `npm test`: run all Vitest tests.
- `npm run test:unit` / `npm run test:integration`: run focused test suites.
- `npm run lint`: run ESLint across the repo.
- `npm run format:check`: verify Prettier formatting.
- `npm run check`: run lint, build, and tests before submitting changes.
- `npm run db:migrate:dev`: apply migrations through the TypeScript CLI.
- `npm run list:groups` and `npm run check:today`: operational WhatsApp utilities.

## Coding Style & Naming Conventions

Use ESM TypeScript. Follow Prettier settings: 100-column print width, double quotes, and no
trailing commas. ESLint uses `@eslint/js` and `typescript-eslint` recommended rules. Prefer small
modules with explicit dependencies and keep adapters separate from domain logic. File names use
kebab-case, such as `birthday-service.ts` and `sqlite-person-repository.ts`. Test files should end
with `.test.ts`.

## Testing Guidelines

Vitest runs in Node and includes `tests/**/*.test.ts`. Add unit tests for pure domain, config,
scheduler, and adapter behavior; add integration tests when migrations, SQLite repositories, app
runtime flow, or operational workflows change. Run `npm run check` before opening a PR.

## Commit & Pull Request Guidelines

Recent history uses concise imperative commits, sometimes Conventional Commits, for example
`feat: add Baileys WhatsApp integration` and `Record OpenAI fallback metadata`. Prefer
`type: summary` for feature/fix/test/docs changes, or a short imperative summary when no type fits.
PRs should describe the change, list verification commands, link relevant issues, and include
screenshots or logs only when they clarify operational behavior.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local setup. Never commit `.env`, WhatsApp session data, SQLite
databases, backups, or logs containing personal data. Keep `WHATSAPP_AUTH_DIR`, `DATABASE_PATH`,
`WHATSAPP_GROUP_ID`, and `OPENAI_API_KEY` environment-specific.
