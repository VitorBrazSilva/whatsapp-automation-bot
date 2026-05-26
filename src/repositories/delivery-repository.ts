export type DeliveryStatus = "sent" | "failed" | "skipped";

export interface DeliveryAttemptInput {
  personId: string;
  groupId: string;
  birthdayYear: number;
  checkId: string;
  messageText: string;
  status: DeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface DeliveryAttempt extends DeliveryAttemptInput {
  id: string;
  createdAt: Date;
}

export interface DeliveryRepository {
  hasSuccessfulDelivery(personId: string, groupId: string, birthdayYear: number): Promise<boolean>;
  recordAttempt(input: DeliveryAttemptInput): Promise<DeliveryAttempt>;
}
