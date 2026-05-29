import type { AutomationTargetLink } from "../../../../application/index.js";
import type { WhatsappTarget } from "../../../../domain/index.js";

export interface RawTargetRow {
  id: string;
  jid: string;
  displayName: string;
  type: "group";
  active: number | boolean;
}

export interface RawAutomationTargetRow {
  id: string;
  automationKey: string;
  targetId: string;
  targetJid: string;
  displayName: string;
  active: number | boolean;
}

export function rawTargetRowToDomain(row: RawTargetRow): WhatsappTarget {
  return {
    id: row.id,
    jid: row.jid,
    displayName: row.displayName,
    type: row.type,
    active: Boolean(row.active)
  };
}

export function rawAutomationTargetRowToLink(row: RawAutomationTargetRow): AutomationTargetLink {
  return {
    id: row.id,
    automationKey: row.automationKey,
    targetId: row.targetId,
    targetJid: row.targetJid,
    displayName: row.displayName,
    active: Boolean(row.active)
  };
}
