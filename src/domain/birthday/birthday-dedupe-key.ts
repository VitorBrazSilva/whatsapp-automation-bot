export class BirthdayDedupeKey {
  private constructor(readonly value: string) {}

  static create(personId: string, birthdayYear: number): BirthdayDedupeKey {
    if (personId.trim().length === 0) {
      throw new Error("Person id is required to create a birthday dedupe key.");
    }
    if (!Number.isInteger(birthdayYear) || birthdayYear < 1900) {
      throw new Error("Birthday year must be a valid year.");
    }
    return new BirthdayDedupeKey(`birthday:${personId}:${birthdayYear}`);
  }

  toString(): string {
    return this.value;
  }
}

export function createBirthdayDedupeKey(personId: string, birthdayYear: number): string {
  return BirthdayDedupeKey.create(personId, birthdayYear).toString();
}
