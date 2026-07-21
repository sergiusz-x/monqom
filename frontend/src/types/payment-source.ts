import type { ApiPaymentSourceType } from "@/types/api-contracts";

export type PaymentSourceType = ApiPaymentSourceType;

export interface PaymentSource {
  id: string;
  workspaceId: string;
  name: string;
  type: PaymentSourceType;
  systemKey: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
