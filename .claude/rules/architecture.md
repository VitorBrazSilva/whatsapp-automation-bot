# Architecture Rules

These rules apply to the birthday WhatsApp bot unless a newer PRD or tech spec explicitly changes the decision.

## Stack

- Use Node.js with TypeScript for the application code.
- Keep the first version as a backend/service process, not a web app.
- Do not add a REST API, admin panel, or frontend in v1 unless explicitly requested.
- Prefer small modules with clear boundaries over broad framework abstractions.

## Runtime Model

- The bot must run as a single continuous process.
- The process must be safe to restart at any time.
- Startup must check pending birthday deliveries for the current local day.
- Reconnection to WhatsApp must trigger a recovery check for unsent birthdays.
- The default timezone is `America/Sao_Paulo`.

## Persistence

- Use SQLite as the primary persistence layer for v1.
- Keep database migrations versioned in the repository.
- Store application secrets outside Git.
- Store Baileys session data and the SQLite database in a persistent volume in deployed environments.
- Do not replace SQLite with MongoDB, Postgres, or another database without updating the tech spec.

## Idempotency

- Every delivery decision must check whether a successful message already exists for the same person, group, and birthday year.
- The database must enforce or support duplicate prevention, not only application memory.
- Retried checks must not resend a successful birthday message.

## Scope Control

- v1 supports one configured WhatsApp group.
- Multi-group support, private messages, campaigns, dashboards, user accounts, and approval workflows are outside v1.
- Prefer CLI/npm scripts for operational actions in v1.

