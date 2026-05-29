export interface Person {
  id: string;
  name: string;
  nickname: string | null;
  birthDate: string;
  relationship: string | null;
  profession: string | null;
  hobbies: string | null;
  traits: string | null;
  messageStyle: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
