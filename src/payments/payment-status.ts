import { PaymentStatus } from '../generated/prisma/enums.js';

const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ['AWAITING_CONFIRMATION', 'FAILED', 'CANCELLED'],
  AWAITING_CONFIRMATION: ['CONFIRMED', 'FAILED', 'UNCONFIRMED'],
  UNCONFIRMED: ['CONFIRMED', 'FAILED'],
  CONFIRMED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
