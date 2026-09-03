import { z } from 'zod';

export const paymentMethodSchema = z.enum(['PIX', 'BOLETO', 'CARD']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export function isValidCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!/^(?:\d{11}|\d{14})$/.test(digits) || /^(\d)\1+$/.test(digits))
    return false;

  const validDigit = (base: string, weights: number[]) => {
    const sum = base
      .split('')
      .reduce(
        (total, digit, index) => total + Number(digit) * weights[index],
        0,
      );
    const remainder = sum % 11;
    return String(remainder < 2 ? 0 : 11 - remainder);
  };

  if (digits.length === 11) {
    const first = validDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = validDigit(
      digits.slice(0, 9) + first,
      [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    return digits.endsWith(first + second);
  }

  const first = validDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const second = validDigit(
    digits.slice(0, 12) + first,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return digits.endsWith(first + second);
}

export const createOrderSchema = z.object({
  giftId: z.string().min(1).max(100),
  clientRequestId: z.uuid(),
  guestName: z.string().trim().min(2).max(100),
  guestEmail: z.email().max(254),
  guestMessage: z.string().trim().max(500).optional().default(''),
  cpfCnpj: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().refine(isValidCpfCnpj, 'Informe um CPF ou CNPJ válido.')),
  paymentMethod: paymentMethodSchema,
  privacyAccepted: z.literal(true),
});

export const giftInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(500),
  priceInCents: z.number().int().min(100).max(10_000_000),
  imageUrl: z.string().trim().max(1_000).optional().nullable(),
  categoryId: z.string().trim().max(100).optional().nullable(),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const weddingInputSchema = z.object({
  partnerOneName: z.string().trim().min(1).max(80),
  partnerTwoName: z.string().trim().min(1).max(80),
  eventAt: z.iso.datetime({ offset: true }),
  headline: z.string().trim().min(3).max(120),
  welcomeText: z.string().trim().min(3).max(1_500),
  storyTitle: z.string().trim().min(3).max(150),
  story: z.string().trim().min(3).max(5_000),
  venueName: z.string().trim().min(2).max(150),
  venueAddress: z.string().trim().min(3).max(300),
  venueInstructions: z.string().trim().max(1_000),
  mapsUrl: z.union([z.literal(''), z.url().max(1_000)]).nullable(),
  heroImageUrl: z.union([z.literal(''), z.string().max(1_000)]).nullable(),
  published: z.boolean(),
});

export type InternalOrderStatus =
  | 'PENDING'
  | 'CREATING'
  | 'UNKNOWN'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'CANCELED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'CHARGEBACK';
export type SettlementStatus =
  | 'PENDING'
  | 'AVAILABLE'
  | 'PARTIAL_REVERSED'
  | 'REVERSED';

export function resolveOrderStatus(
  current: string,
  incoming?: InternalOrderStatus,
) {
  if (!incoming || current === incoming) return current;
  if (incoming === 'REFUNDED' || incoming === 'CHARGEBACK') return incoming;
  if (current === 'REFUNDED' || current === 'CHARGEBACK') return current;
  if (incoming === 'PARTIALLY_REFUNDED')
    return current === 'CONFIRMED' ? incoming : current;
  if (current === 'PARTIALLY_REFUNDED' && incoming !== 'CONFIRMED')
    return current;
  if (incoming === 'CONFIRMED') return incoming;
  if (current === 'CONFIRMED') return current;
  return incoming;
}

export function resolveSettlementStatus(
  current: string,
  incoming?: SettlementStatus,
) {
  if (!incoming || current === incoming) return current;
  const rank: Record<SettlementStatus, number> = {
    PENDING: 0,
    AVAILABLE: 1,
    PARTIAL_REVERSED: 2,
    REVERSED: 3,
  };
  const currentRank = rank[current as SettlementStatus] ?? 0;
  return rank[incoming] >= currentRank ? incoming : current;
}

export function mapAsaasEvent(eventType: string): {
  status?: InternalOrderStatus;
  settlementStatus?: SettlementStatus;
} {
  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'CHECKOUT_PAID':
      return { status: 'CONFIRMED', settlementStatus: 'PENDING' };
    case 'PAYMENT_RECEIVED':
      return { status: 'CONFIRMED', settlementStatus: 'AVAILABLE' };
    case 'PAYMENT_OVERDUE':
    case 'CHECKOUT_EXPIRED':
      return { status: 'EXPIRED' };
    case 'PAYMENT_DELETED':
    case 'CHECKOUT_CANCELED':
    case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
    case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
      return { status: 'CANCELED' };
    case 'PAYMENT_REFUNDED':
      return { status: 'REFUNDED', settlementStatus: 'REVERSED' };
    case 'PAYMENT_PARTIALLY_REFUNDED':
      return {
        status: 'PARTIALLY_REFUNDED',
        settlementStatus: 'PARTIAL_REVERSED',
      };
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':
      return { status: 'CHARGEBACK', settlementStatus: 'REVERSED' };
    default:
      return {};
  }
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function formatBrlFromCents(valueInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100);
}
