# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js + TypeScript + NestJS WhatsApp automation bot. Source code lives in `src/`.
`src/index.ts` starts the app, while CLI wrappers are in `src/cli/`. Business rules belong in
`src/domain/`; use cases and ports live in `src/application/`; adapters for TypeORM, Baileys,
OpenAI, config, observability, and Nest composition live in `src/infrastructure/`; driver adapters
for CLI, scheduler, health, and metrics live in `src/presentation/`. Tests are in `tests/`, grouped
by `unit/`, `integration/`, `e2e/`, `architecture/`, and focused adapter suites. SQL migrations are
in `migrations/` and operational documentation is in `docs/`.

## Build, Test, and Development Commands

- `npm run dev`: run the service locally with `tsx src/index.ts`.
- `npm run build`: compile TypeScript into `dist/`.
- `npm start`: run the compiled app from `dist/index.js`.
- `npm test`: run all Vitest tests.
- `npm run test:unit` / `npm run test:integration`: run focused suites.
- `npm run lint`: run ESLint.
- `npm run format:check`: verify Prettier formatting.
- `npm run check`: run lint, build, and tests before submitting.
- `npm run db:migrate:dev`: apply migrations through the TypeScript CLI.
- `npm run birthdays:check-today`: run the birthday automation manually.

## Coding Style & Naming Conventions

Use ESM TypeScript with strict compiler settings. Keep dependencies flowing inward: domain and
application code must not import NestJS, TypeORM, runtime config, or infrastructure adapters.
Prettier uses 100 columns, double quotes, and no trailing commas. ESLint uses `@eslint/js` and
`typescript-eslint` recommended rules. Prefer kebab-case file names, such as
`run-birthday-automation-use-case.ts` or `typeorm-person-repository.adapter.ts`.

## Testing Guidelines

Vitest runs in Node and discovers `tests/**/*.test.ts`. Name tests with the `.test.ts` suffix. Add
unit tests for domain objects, use cases, config parsing, schedulers, and adapters. Add integration
tests when migrations, TypeORM repositories, runtime bootstrapping, or operational flows change.
Run `npm run check` before opening a pull request.

## Commit & Pull Request Guidelines

Recent commits use concise imperative messages, often Conventional Commits, for example
`refactor: migrate automation to Nest modules` and `docs: add repository contributor guide`.
Prefer `type: summary` with `feat`, `fix`, `test`, `docs`, `chore`, or `refactor`. Pull requests
should describe the change, list verification commands, link relevant issues, and include logs or
screenshots only when they clarify behavior.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local setup. Never commit `.env`, WhatsApp session data, SQLite
databases, backups, or logs with personal data. Treat `data/`, `sessions/`, `dist/`, and local
database files as generated artifacts.
