import type { WhatsappTarget } from "../../../domain/index.js";

export interface AutomationTargetLink {
  id: string;
  automationKey: string;
  targetId: string;
  targetJid: string;
  displayName: string;
  active: boolean;
}

export interface TargetResolverPort {
  findActiveTargets(automationKey: string): Promise<WhatsappTarget[]>;
}

export interface TargetConfigurationPort extends TargetResolverPort {
  addGroupTarget(automationKey: string, jid: string, displayName?: string): Promise<void>;
  listAutomationTargets(automationKey?: string): Promise<AutomationTargetLink[]>;
}
