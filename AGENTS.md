# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js + TypeScript + NestJS WhatsApp birthday automation bot. Application code lives in
`src/`. The main entry point is `src/index.ts`; npm command wrappers stay in `src/cli/*.ts`.
Business rules belong in `src/domain/`. Use cases and ports live in `src/application/`.
Driven adapters live in `src/infrastructure/` for TypeORM, Baileys, OpenAI, config,
observability, health probes, and Nest composition. Driver adapters live in `src/presentation/`
for CLI commands, health/metrics controllers, and scheduler integration. Compatibility folders such
as `src/database/`, `src/automation/`, and `src/targets/` contain Nest modules or transitional
exports and should not receive new business logic. Tests are under `tests/`, split into `unit/`,
`integration/`, `e2e/`, `architecture/`, and focused repository or observability suites. SQL
migrations live in `migrations/`; operational notes live in `docs/`. Treat `data/`, `sessions/`,
local SQLite files, logs, and `dist/` as generated data.

## Build, Test, and Development Commands

- `npm run dev`: run the bot locally with `tsx src/index.ts`.
- `npm run build`: compile TypeScript into `dist/`.
- `npm start`: run the compiled app from `dist/index.js`.
- `npm test`: run all Vitest tests.
- `npm run test:unit` / `npm run test:integration`: run focused test suites.
- `npm run lint`: run ESLint across the repository.
- `npm run format:check`: verify Prettier formatting.
- `npm run check`: run lint, build, and tests before submitting changes.
- `npm run db:migrate:dev`: apply database migrations through the TypeScript CLI.
- `npm run whatsapp:list-groups`: connect with Baileys and list WhatsApp groups.
- `npm run targets:add -- birthdays.daily <groupJid>`: bind a group target to the automation.
- `npm run targets:list -- birthdays.daily`: list configured automation targets.
- `npm run birthdays:check-today`: run the birthday automation manually.

## Coding Style & Naming Conventions

Use ESM TypeScript with small modules and explicit dependencies. Follow the Clean/Hexagonal
dependency rule: `infrastructure` and `presentation` may depend inward on `application` and
`domain`; `domain` and `application` must not import NestJS, TypeORM, adapters, or runtime config.
Follow Prettier settings: 100-column print width, double quotes, and no trailing commas. ESLint uses
`@eslint/js` and `typescript-eslint` recommended rules. File names should use kebab-case, such as
`run-birthday-automation.use-case.ts` or `typeorm-person-repository.adapter.ts`. Test files should
end in `.test.ts`.

## Testing Guidelines

Vitest runs in Node and discovers `tests/**/*.test.ts`. Add unit tests for domain value objects,
use cases, config parsing, scheduler behavior, and adapters. Add integration tests when migrations,
TypeORM adapters, app runtime flow, or operational workflows change. Keep architecture boundary
tests passing whenever imports move. Run `npm run check` before opening a pull request.

## Commit & Pull Request Guidelines

Recent history uses concise imperative commits, often Conventional Commits, such as
`refactor: migrate automation to Nest modules` or `docs: add repository contributor guide`. Prefer
`type: summary` for feature, fix, test, docs, chore, or refactor changes. Pull requests should
describe the change, list verification commands, link relevant issues, and include logs only when
they clarify operational behavior.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local setup. Never commit `.env`, WhatsApp session data, SQLite
databases, backups, or logs containing personal data. Keep `WHATSAPP_AUTH_DIR`, `DATABASE_PATH`,
`WHATSAPP_GROUP_ID`, and `OPENAI_API_KEY` environment-specific.
