import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  type AutomationTargetLink,
  type TargetConfigurationPort
} from "../../../application/index.js";
import { APP_CONFIG, type AppConfig } from "../../config/index.js";
import type { WhatsappTarget } from "../../../domain/index.js";
import type { TargetResolver } from "../../../targets/target-resolver.js";
import { AutomationTargetEntity, WhatsappTargetEntity } from "./entities/index.js";
import {
  rawAutomationTargetRowToLink,
  rawTargetRowToDomain,
  type RawAutomationTargetRow,
  type RawTargetRow
} from "./mappers/index.js";

export const DEFAULT_BIRTHDAY_AUTOMATION_KEY = "birthdays.daily";

@Injectable()
export class TargetsService implements TargetResolver, TargetConfigurationPort {
  constructor(
    @InjectRepository(WhatsappTargetEntity)
    private readonly targets: Repository<WhatsappTargetEntity>,
    @InjectRepository(AutomationTargetEntity)
    private readonly automationTargets: Repository<AutomationTargetEntity>,
    @Inject(APP_CONFIG)
    private readonly config: AppConfig
  ) {}

  async addGroupTarget(automationKey: string, jid: string, displayName?: string): Promise<void> {
    assertGroupJid(jid);
    const now = new Date();
    const target = await this.upsertTarget(jid, displayName ?? jid, now);
    await this.upsertAutomationTarget(automationKey, target.id, now);
  }

  async ensureLegacyBirthdayTarget(): Promise<void> {
    if (this.config.whatsappGroupId === null) {
      return;
    }
    await this.addGroupTarget(DEFAULT_BIRTHDAY_AUTOMATION_KEY, this.config.whatsappGroupId);
  }

  async findActiveTargets(automationKey: string): Promise<WhatsappTarget[]> {
    const rows = await this.automationTargets
      .createQueryBuilder("automationTarget")
      .innerJoin(
        WhatsappTargetEntity,
        "target",
        "target.id = automationTarget.target_id AND target.active = :active",
        { active: true }
      )
      .where("automationTarget.automation_key = :automationKey", { automationKey })
      .andWhere("automationTarget.active = :active", { active: true })
      .select([
        "target.id AS id",
        "target.jid AS jid",
        "target.display_name AS displayName",
        "target.type AS type",
        "target.active AS active"
      ])
      .orderBy("target.display_name", "ASC")
      .getRawMany<RawTargetRow>();
    return rows.map(rawTargetRowToDomain);
  }

  async listAutomationTargets(automationKey?: string): Promise<AutomationTargetLink[]> {
    const query = this.automationTargets
      .createQueryBuilder("automationTarget")
      .innerJoin(WhatsappTargetEntity, "target", "target.id = automationTarget.target_id")
      .select([
        "automationTarget.id AS id",
        "automationTarget.automation_key AS automationKey",
        "automationTarget.target_id AS targetId",
        "automationTarget.active AS active",
        "target.jid AS targetJid",
        "target.display_name AS displayName"
      ])
      .orderBy("automationTarget.automation_key", "ASC")
      .addOrderBy("target.display_name", "ASC");
    if (automationKey !== undefined) {
      query.where("automationTarget.automation_key = :automationKey", { automationKey });
    }
    const rows = await query.getRawMany<RawAutomationTargetRow>();
    return rows.map(rawAutomationTargetRowToLink);
  }

  private async upsertTarget(
    jid: string,
    displayName: string,
    now: Date
  ): Promise<WhatsappTargetEntity> {
    const existing = await this.targets.findOneBy({ jid });
    if (existing !== null) {
      existing.displayName = existing.displayName || displayName;
      existing.active = true;
      existing.updatedAt = now;
      return this.targets.save(existing);
    }
    return this.targets.save(
      this.targets.create({
        id: randomUUID(),
        jid,
        displayName,
        type: "group",
        active: true,
        createdAt: now,
        updatedAt: now
      })
    );
  }

  private async upsertAutomationTarget(
    automationKey: string,
    targetId: string,
    now: Date
  ): Promise<void> {
    const existing = await this.automationTargets.findOneBy({ automationKey, targetId });
    if (existing !== null) {
      existing.active = true;
      existing.updatedAt = now;
      await this.automationTargets.save(existing);
      return;
    }
    await this.automationTargets.save(
      this.automationTargets.create({
        id: randomUUID(),
        automationKey,
        targetId,
        active: true,
        settingsJson: null,
        createdAt: now,
        updatedAt: now
      })
    );
  }
}

function assertGroupJid(jid: string): void {
  if (!jid.endsWith("@g.us")) {
    throw new Error("Target JID must be a WhatsApp group JID ending with @g.us.");
  }
}
