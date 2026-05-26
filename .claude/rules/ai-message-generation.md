# AI Message Generation Rules

These rules apply to birthday message generation.

## Model Integration

- Use OpenAI Responses API for v1.
- Keep the OpenAI API key in environment variables only.
- Use a timeout and handle provider failures.
- The system must have a local template fallback when AI generation fails.

## Prompt Safety

- The prompt must instruct the model to write in Brazilian Portuguese unless a future requirement changes this.
- The prompt must forbid inventing facts, achievements, relationships, or personal details.
- The prompt must avoid offensive, embarrassing, sexual, commercial, political, medical, or religious content unless explicitly present and appropriate in the person's profile.
- The message must be family-friendly, respectful, and suitable for a WhatsApp group.

## Output Validation

- Generated output must be validated before sending.
- Prefer structured output with a simple schema, such as `{ "message": string }`.
- Reject empty messages, messages that exceed the configured length, or messages that contain obvious placeholders.
- If validation fails, use the template fallback instead of sending invalid content.

## Personalization

- Personalization may use name, nickname, relationship, hobbies, profession, traits, style preference, and approved notes.
- If available profile data is limited, generate a simpler safe message.
- Do not overuse private details in a public family group.
- Avoid repeating the exact same message text when prior history exists.

## Delivery Boundary

- Message generation must not send WhatsApp messages directly.
- The generator returns text and metadata only.
- Sending remains the responsibility of the WhatsApp/delivery service after idempotency checks.

