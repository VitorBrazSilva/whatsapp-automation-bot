import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { PersonRepository } from "../../../application/index.js";
import type { Person } from "../../../domain/index.js";
import { PersonEntity } from "./entities/index.js";
import {
  createPersonPersistenceData,
  personEntityToDomain,
  type CreatePersonPersistenceInput
} from "./mappers/index.js";

export type CreatePersonInput = CreatePersonPersistenceInput;

@Injectable()
export class TypeOrmPersonRepository implements PersonRepository {
  constructor(
    @InjectRepository(PersonEntity)
    private readonly people: Repository<PersonEntity>
  ) {}

  async create(input: CreatePersonInput): Promise<Person> {
    const now = new Date();
    const entity = this.people.create(
      createPersonPersistenceData(input, input.id ?? randomUUID(), now)
    );
    return personEntityToDomain(await this.people.save(entity));
  }

  async findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]> {
    return this.findActiveByBirthday(month, day);
  }

  async findActiveByBirthday(month: number, day: number): Promise<Person[]> {
    const rows = await this.people
      .createQueryBuilder("person")
      .where("person.active = :active", { active: true })
      .andWhere("substr(person.birth_date, 6, 2) = :month", { month: padDatePart(month) })
      .andWhere("substr(person.birth_date, 9, 2) = :day", { day: padDatePart(day) })
      .orderBy("person.name", "ASC")
      .getMany();
    return rows.map(personEntityToDomain);
  }

  async findById(id: string): Promise<Person | null> {
    const person = await this.people.findOneBy({ id });
    return person === null ? null : personEntityToDomain(person);
  }
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
