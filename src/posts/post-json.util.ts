import { PaymentTerms } from '@prisma/client';

const PAYMENT_TERMS_API_MAP: Record<PaymentTerms, string> = {
  [PaymentTerms.PREPAY]: 'PREPAY',
  [PaymentTerms.POSTPAY]: 'POSTPAY',
  [PaymentTerms.FIFTY_FIFTY]: '50_50',
  [PaymentTerms.SAFE_DEAL]: 'SAFE_DEAL',
};

const PAYMENT_TERMS_DB_MAP: Record<string, PaymentTerms> = {
  PREPAY: PaymentTerms.PREPAY,
  POSTPAY: PaymentTerms.POSTPAY,
  '50_50': PaymentTerms.FIFTY_FIFTY,
  FIFTY_FIFTY: PaymentTerms.FIFTY_FIFTY,
  SAFE_DEAL: PaymentTerms.SAFE_DEAL,
};

export function mapBudgetToApi(
  budget: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!budget) {
    return undefined;
  }

  const result = { ...budget };

  if (typeof result.paymentTerms === 'string') {
    const mapped =
      PAYMENT_TERMS_API_MAP[result.paymentTerms as PaymentTerms] ??
      PAYMENT_TERMS_API_MAP[
        PAYMENT_TERMS_DB_MAP[result.paymentTerms] as PaymentTerms
      ];
    if (mapped) {
      result.paymentTerms = mapped;
    }
  }

  return result;
}

export function mapBudgetFromApi(
  budget: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!budget) {
    return undefined;
  }

  const result = { ...budget };

  if (typeof result.paymentTerms === 'string') {
    const mapped = PAYMENT_TERMS_DB_MAP[result.paymentTerms];
    if (mapped) {
      result.paymentTerms = mapped;
    }
  }

  return result;
}

export function jsonToRecord(
  value: unknown
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export function jsonToArray(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item)
  );
}
