import type { AutomationTargetLink, WhatsAppGroup } from "../driven/index.js";

export interface AddGroupTargetCommand {
  automationKey: string;
  jid: string;
  displayName?: string;
}

export interface AddGroupTargetUseCasePort {
  execute(command: AddGroupTargetCommand): Promise<void>;
}

export interface ListAutomationTargetsUseCasePort {
  execute(automationKey?: string): Promise<AutomationTargetLink[]>;
}

export interface ListWhatsAppGroupsUseCasePort {
  execute(): Promise<WhatsAppGroup[]>;
}
