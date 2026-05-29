import type { Person } from "../../../../domain/index.js";
import type { PersonEntity } from "../entities/index.js";

export interface CreatePersonPersistenceInput {
  id?: string;
  name: string;
  nickname?: string | null;
  birthDate: string;
  relationship?: string | null;
  profession?: string | null;
  hobbies?: string | null;
  traits?: string | null;
  messageStyle?: string | null;
  notes?: string | null;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export function personEntityToDomain(entity: PersonEntity): Person {
  return {
    id: entity.id,
    name: entity.name,
    nickname: entity.nickname,
    birthDate: entity.birthDate,
    relationship: entity.relationship,
    profession: entity.profession,
    hobbies: entity.hobbies,
    traits: entity.traits,
    messageStyle: entity.messageStyle,
    notes: entity.notes,
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
}

export function createPersonPersistenceData(
  input: CreatePersonPersistenceInput,
  id: string,
  now: Date
): Partial<PersonEntity> {
  return {
    id,
    name: input.name,
    nickname: input.nickname ?? null,
    birthDate: input.birthDate,
    relationship: input.relationship ?? null,
    profession: input.profession ?? null,
    hobbies: input.hobbies ?? null,
    traits: input.traits ?? null,
    messageStyle: input.messageStyle ?? null,
    notes: input.notes ?? null,
    active: input.active ?? true,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}
