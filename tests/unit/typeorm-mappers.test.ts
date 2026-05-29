import { describe, expect, it } from "vitest";
import {
  AutomationRunEntity,
  MessageDeliveryEntity,
  PersonEntity,
  automationRunEntityToDomain,
  createPersonPersistenceData,
  messageDeliveryEntityToRecordedDelivery,
  personEntityToDomain,
  rawAutomationTargetRowToLink,
  rawTargetRowToDomain
} from "../../src/infrastructure/index.js";

const now = new Date("2026-05-26T12:00:00.000Z");

describe("TypeORM persistence mappers", () => {
  it("maps person entities to domain people and persistence data", () => {
    const data = createPersonPersistenceData(
      {
        name: "Ana",
        birthDate: "1990-05-26"
      },
      "person-1",
      now
    );
    const entity = Object.assign(new PersonEntity(), data);

    expect(data).toMatchObject({
      id: "person-1",
      nickname: null,
      active: true,
      createdAt: now
    });
    expect(personEntityToDomain(entity)).toMatchObject({
      id: "person-1",
      name: "Ana",
      birthDate: "1990-05-26"
    });
  });

  it("maps automation run entities to application run models", () => {
    const entity = Object.assign(new AutomationRunEntity(), {
      id: "run-1",
      automationKey: "birthdays.daily",
      trigger: "manual" as const,
      targetDate: "2026-05-26",
      timezone: "America/Sao_Paulo"
    });

    expect(automationRunEntityToDomain(entity)).toEqual({
      id: "run-1",
      automationKey: "birthdays.daily",
      trigger: "manual",
      targetDate: "2026-05-26",
      timezone: "America/Sao_Paulo"
    });
  });

  it("maps delivery entities to recorded deliveries", () => {
    const entity = Object.assign(new MessageDeliveryEntity(), {
      id: "delivery-1",
      createdAt: now
    });

    expect(messageDeliveryEntityToRecordedDelivery(entity)).toEqual({
      id: "delivery-1",
      createdAt: now
    });
  });

  it("maps raw target query rows to domain and application models", () => {
    expect(
      rawTargetRowToDomain({
        id: "target-1",
        jid: "family@g.us",
        displayName: "Familia",
        type: "group",
        active: 1
      })
    ).toEqual({
      id: "target-1",
      jid: "family@g.us",
      displayName: "Familia",
      type: "group",
      active: true
    });

    expect(
      rawAutomationTargetRowToLink({
        id: "link-1",
        automationKey: "birthdays.daily",
        targetId: "target-1",
        targetJid: "family@g.us",
        displayName: "Familia",
        active: 0
      })
    ).toEqual({
      id: "link-1",
      automationKey: "birthdays.daily",
      targetId: "target-1",
      targetJid: "family@g.us",
      displayName: "Familia",
      active: false
    });
  });
});
