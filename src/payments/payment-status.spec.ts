import { PaymentStatus } from '../generated/prisma/enums.js';
import { canTransition } from './payment-status.js';

const {
  PENDING,
  AWAITING_CONFIRMATION,
  CONFIRMED,
  FAILED,
  UNCONFIRMED,
  CANCELLED,
} = PaymentStatus;

const ALLOWED: [PaymentStatus, PaymentStatus][] = [
  [PENDING, AWAITING_CONFIRMATION],
  [PENDING, FAILED],
  [PENDING, CANCELLED],
  [AWAITING_CONFIRMATION, CONFIRMED],
  [AWAITING_CONFIRMATION, FAILED],
  [AWAITING_CONFIRMATION, UNCONFIRMED],
  [UNCONFIRMED, CONFIRMED],
  [UNCONFIRMED, FAILED],
];

const ALL_PAIRS = Object.values(PaymentStatus).flatMap((from) =>
  Object.values(PaymentStatus).map((to) => [from, to] as const),
);

const isAllowed = (from: PaymentStatus, to: PaymentStatus) =>
  ALLOWED.some(([f, t]) => f === from && t === to);

describe('canTransition', () => {
  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(ALL_PAIRS.filter(([from, to]) => !isAllowed(from, to)))(
    'rejects %s -> %s',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    },
  );

  it.each([CONFIRMED, FAILED, CANCELLED])('treats %s as final', (from) => {
    for (const to of Object.values(PaymentStatus)) {
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it('never lets a payment skip straight from PENDING to CONFIRMED', () => {
    expect(canTransition(PENDING, CONFIRMED)).toBe(false);
  });
});
