import { OpenAiResponsesApiError } from "./openai-responses-client.js";
import type { OpenAiFallbackDetails } from "./types.js";

export function readFallbackReason(error: unknown): string {
  if (error instanceof OpenAiResponsesApiError) {
    return `OPENAI_HTTP_${error.status}`;
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("timed out")) {
      return "OPENAI_TIMEOUT";
    }
    return error.name === "Error" ? "OPENAI_ERROR" : error.name;
  }
  return "OPENAI_ERROR";
}

export function readFallbackDetails(error: unknown): OpenAiFallbackDetails | null {
  if (error instanceof OpenAiResponsesApiError) {
    return {
      status: error.status,
      statusText: error.statusText || null,
      requestId: error.requestId
    };
  }
  return null;
}
