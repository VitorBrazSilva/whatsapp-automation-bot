import { Injectable } from "@nestjs/common";
import type { AutomationHandler } from "./automation-contracts.js";

@Injectable()
export class AutomationRegistryService {
  private readonly handlers = new Map<string, AutomationHandler>();

  register(handler: AutomationHandler): void {
    if (this.handlers.has(handler.key)) {
      throw new Error(`Automation handler already registered for ${handler.key}.`);
    }
    this.handlers.set(handler.key, handler);
  }

  get(key: string): AutomationHandler {
    const handler = this.handlers.get(key);
    if (handler === undefined) {
      throw new Error(`Automation handler not found for ${key}.`);
    }
    return handler;
  }
}
