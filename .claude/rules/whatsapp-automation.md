# WhatsApp Automation Rules

These rules apply to all WhatsApp integration work in this project.

## Integration Choice

- Use Baileys via WhatsApp Web / Linked Devices for v1.
- Treat Baileys as an unofficial integration that can break or disconnect.
- Do not describe this project as using an official WhatsApp group API.
- Do not switch to WhatsApp Business Cloud API for group sending unless the product scope changes.

## Session Handling

- Persist Baileys credentials in a durable, non-Git location.
- Never commit QR sessions, auth state, tokens, phone numbers, or group identifiers.
- The bot must expose an operational way to list groups and select the configured group id.
- The bot must handle disconnect and reconnect events explicitly.

## Sending Rules

- All sends must go through the delivery/idempotency layer.
- Do not send messages directly from scheduler code.
- Do not implement mass messaging, campaigns, broadcast behavior, or unsolicited messaging.
- Keep volume low and aligned with personal/family use.
- Do not add auto-reply behavior unless a future PRD requires it.

## Failure Handling

- Failed sends must be recorded with known error information.
- WhatsApp disconnected at the scheduled time must not be treated as final failure.
- On reconnect, the bot must check pending birthday messages for the current local day.
- Retrying must respect duplicate prevention.

## Operational Risk

- Documentation and specs must mention that WhatsApp personal automation may be unstable or restricted by platform rules.
- Avoid implementation choices that increase account risk, such as high-frequency sends or spam-like behavior.

