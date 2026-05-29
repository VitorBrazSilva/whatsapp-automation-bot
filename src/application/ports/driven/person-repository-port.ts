import type { Person } from "../../../domain/index.js";

export interface PersonRepositoryPort {
  findBirthdaysByMonthDay(month: number, day: number): Promise<Person[]>;
  findById(id: string): Promise<Person | null>;
}
