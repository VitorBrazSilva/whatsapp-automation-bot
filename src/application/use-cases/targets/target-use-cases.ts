import type {
  AddGroupTargetCommand,
  AddGroupTargetUseCasePort,
  AutomationTargetLink,
  ListAutomationTargetsUseCasePort,
  ListWhatsAppGroupsUseCasePort,
  TargetConfigurationPort,
  WhatsAppGroupListerPort,
  WhatsAppGroup
} from "../../ports/index.js";

export class AddGroupTargetUseCase implements AddGroupTargetUseCasePort {
  constructor(private readonly targets: TargetConfigurationPort) {}

  async execute(command: AddGroupTargetCommand): Promise<void> {
    await this.targets.addGroupTarget(command.automationKey, command.jid, command.displayName);
  }
}

export class ListAutomationTargetsUseCase implements ListAutomationTargetsUseCasePort {
  constructor(private readonly targets: TargetConfigurationPort) {}

  async execute(automationKey?: string): Promise<AutomationTargetLink[]> {
    return this.targets.listAutomationTargets(automationKey);
  }
}

export class ListWhatsAppGroupsUseCase implements ListWhatsAppGroupsUseCasePort {
  constructor(private readonly whatsapp: WhatsAppGroupListerPort) {}

  async execute(): Promise<WhatsAppGroup[]> {
    return this.whatsapp.listGroups();
  }
}
