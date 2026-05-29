import type { OpenAiCreateResponseResult } from "./openai-responses-client.js";
import type { JsonObject } from "./types.js";

export function readMessagePayload(response: OpenAiCreateResponseResult): { message: unknown } {
  const outputText = readOutputText(response);
  const parsed = JSON.parse(outputText) as unknown;
  if (isMessagePayload(parsed)) {
    return parsed;
  }
  throw new Error("OpenAI response did not match the expected message payload.");
}

function readOutputText(response: OpenAiCreateResponseResult): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }
  const output = response.output;
  if (!Array.isArray(output)) {
    throw new Error("OpenAI response did not include output text.");
  }
  for (const item of output) {
    if (!isJsonObject(item) || item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (
        isJsonObject(content) &&
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }
  throw new Error("OpenAI response did not include output text.");
}

function isMessagePayload(value: unknown): value is { message: unknown } {
  return isJsonObject(value) && "message" in value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
