# Privacy And Data Rules

These rules apply to all data handling in the birthday WhatsApp bot.

## Data Classification

- Treat names, birth dates, family relationships, hobbies, traits, profession, notes, group ids, phone numbers, and message history as personal data.
- Store only data needed for birthday message generation and delivery history.
- Do not add sensitive categories such as religion, health, politics, finances, or precise location unless explicitly required and justified.

## Storage

- Keep `.env`, SQLite database files, backups, logs with personal data, and WhatsApp session files out of Git.
- Provide `.env.example` only with placeholder values.
- Prefer restrictive file permissions in deployed environments.
- Backups must be intentional and documented; no automatic third-party sync by default.

## Logging

- Logs must be useful for diagnosis without exposing unnecessary personal details.
- Log person ids and delivery ids by default instead of full profile details.
- Avoid logging full generated messages at `info` level.
- Error logs must not include API keys, WhatsApp sessions, QR data, or raw OpenAI request payloads.

## AI Data Minimization

- Send only the fields needed for a specific birthday message to the AI provider.
- Do not include unrelated family members in a prompt.
- Do not include private notes unless they are explicitly intended to guide the message.
- The AI prompt must instruct the model not to invent facts.

## Access

- Assume the first version has a single operator.
- Do not introduce complex user roles in v1.
- If a web/admin interface is added later, authentication and access control must be specified before implementation.

