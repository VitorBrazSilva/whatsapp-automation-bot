import type { Person } from "../domain/index.js";

export interface BirthdayMessageInput {
  person: Person;
  priorMessages: string[];
}

export interface GeneratedMessage {
  message: string;
  provider: "openai" | "fallback";
}

export interface MessageGenerator {
  generate(input: BirthdayMessageInput): Promise<GeneratedMessage>;
}
