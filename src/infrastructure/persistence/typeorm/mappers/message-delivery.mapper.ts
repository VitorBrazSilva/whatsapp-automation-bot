import type { RecordedDelivery } from "../../../../application/index.js";
import type { MessageDeliveryEntity } from "../entities/index.js";

export function messageDeliveryEntityToRecordedDelivery(
  entity: MessageDeliveryEntity
): RecordedDelivery {
  return {
    id: entity.id,
    createdAt: entity.createdAt
  };
}
