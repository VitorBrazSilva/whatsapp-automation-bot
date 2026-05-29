import type { JsonObject } from "./types.js";

export interface OpenAiResponsesClient {
  createResponse(
    input: OpenAiCreateResponseRequest,
    signal: AbortSignal
  ): Promise<OpenAiCreateResponseResult>;
}

export interface OpenAiCreateResponseRequest {
  model: string;
  instructions: string;
  input: Array<{
    role: "user";
    content: Array<{
      type: "input_text";
      text: string;
    }>;
  }>;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: boolean;
      schema: JsonObject;
    };
  };
  max_output_tokens: number;
  temperature: number;
  store: boolean;
}

export interface OpenAiCreateResponseResult {
  output_text?: unknown;
  output?: unknown;
}

export class OpenAiResponsesApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly requestId: string | null;
  readonly responseBody: string;

  constructor(options: {
    status: number;
    statusText: string;
    requestId: string | null;
    responseBody: string;
  }) {
    super(`OpenAI Responses API request failed with status ${options.status}.`);
    this.name = "OpenAiResponsesApiError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.requestId = options.requestId;
    this.responseBody = options.responseBody;
  }
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export class FetchOpenAiResponsesClient implements OpenAiResponsesClient {
  constructor(private readonly apiKey: string) {}

  async createResponse(
    input: OpenAiCreateResponseRequest,
    signal: AbortSignal
  ): Promise<OpenAiCreateResponseResult> {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new OpenAiResponsesApiError({
        status: response.status,
        statusText: response.statusText,
        requestId: readOpenAiRequestId(response),
        responseBody: await readResponseBody(response)
      });
    }
    return (await response.json()) as OpenAiCreateResponseResult;
  }
}

function readOpenAiRequestId(response: Response): string | null {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("openai-request-id") ??
    null
  );
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
