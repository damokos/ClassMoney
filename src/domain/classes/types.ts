export interface Class {
  id: number;
  code: string;
  displayName: string;
  currency: string;
  currencyDecimals: number;
  balance: number;
  timezone: string;
  bankAccountNumber: string | null;
  active: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassInput {
  code: string;
  displayName: string;
  currency: string;
  currencyDecimals: number;
  timezone: string;
  bankAccountNumber?: string | null;
}

export interface UpdateClassInput {
  displayName?: string;
  currency?: string;
  currencyDecimals?: number;
  timezone?: string;
  bankAccountNumber?: string | null;
}
