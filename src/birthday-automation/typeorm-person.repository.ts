import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Person } from "../domain/index.js";
import { PersonEntity } from "../database/index.js";
import type { CreatePersonInput, PersonRepository } from "../repositories/index.js";

@Injectable()
export class TypeOrmPersonRepository implements PersonRepository {
  constructor(
    @InjectRepository(PersonEntity)
    private readonly people: Repository<PersonEntity>
  ) {}

  async create(input: CreatePersonInput): Promise<Person> {
    const now = new Date();
    const entity = this.people.create({
      id: input.id ?? randomUUID(),
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
    });
    return mapPerson(await this.people.save(entity));
  }

  async findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]> {
    const rows = await this.people
      .createQueryBuilder("person")
      .where("person.active = :active", { active: true })
      .andWhere("substr(person.birth_date, 6, 2) = :month", { month: padDatePart(month) })
      .andWhere("substr(person.birth_date, 9, 2) = :day", { day: padDatePart(day) })
      .orderBy("person.name", "ASC")
      .getMany();
    return rows.map(mapPerson);
  }

  async findById(id: string): Promise<Person | null> {
    const person = await this.people.findOneBy({ id });
    return person === null ? null : mapPerson(person);
  }
}

function mapPerson(entity: PersonEntity): Person {
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

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
