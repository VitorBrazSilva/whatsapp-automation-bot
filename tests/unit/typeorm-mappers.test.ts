import { describe, expect, it } from "vitest";
import {
  PersonEntity,
  createPersonPersistenceData,
  personEntityToDomain
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
});
