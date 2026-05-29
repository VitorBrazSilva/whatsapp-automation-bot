import type { WhatsappTarget } from "../domain/index.js";

export const TARGET_RESOLVER = Symbol("TARGET_RESOLVER");

export type { WhatsappTarget } from "../domain/index.js";

export interface AutomationTargetLink {
  id: string;
  automationKey: string;
  targetId: string;
  targetJid: string;
  displayName: string;
  active: boolean;
}

export interface TargetResolver {
  findActiveTargets(automationKey: string): Promise<WhatsappTarget[]>;
}
