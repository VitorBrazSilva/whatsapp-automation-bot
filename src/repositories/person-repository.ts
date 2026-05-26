import type { Person } from "../domain/index.js";

export interface CreatePersonInput {
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

export interface PersonRepository {
  create(input: CreatePersonInput): Promise<Person>;
  findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]>;
  findById(id: string): Promise<Person | null>;
}
