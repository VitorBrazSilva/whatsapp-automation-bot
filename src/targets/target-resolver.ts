export const TARGET_RESOLVER = Symbol("TARGET_RESOLVER");

export interface WhatsappTarget {
  id: string;
  jid: string;
  displayName: string;
  type: "group";
  active: boolean;
}

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
