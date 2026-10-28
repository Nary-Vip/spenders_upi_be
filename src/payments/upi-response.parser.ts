import { PaymentStatus } from '../generated/prisma/enums.js';

export interface UpiResult {
  status: Extract<PaymentStatus, 'AWAITING_CONFIRMATION' | 'FAILED'>;
  upiTxnId?: string;
  upiRef?: string;
}

const FAILURE_STATUSES = new Set(['failure', 'failed']);

export function parseUpiResponse(raw: string): UpiResult {
  const fields = parseFields(raw);
  const status = fields.get('status')?.toLowerCase();

  const result: UpiResult = {
    status:
      status && FAILURE_STATUSES.has(status)
        ? 'FAILED'
        : 'AWAITING_CONFIRMATION',
  };
  const upiTxnId = fields.get('txnid');
  const upiRef = fields.get('approvalrefno');
  if (upiTxnId) result.upiTxnId = upiTxnId;
  if (upiRef) result.upiRef = upiRef;
  return result;
}

function parseFields(raw: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const pair of raw.trim().split('&')) {
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const key = pair.slice(0, separator).trim().toLowerCase();
    const value = decode(pair.slice(separator + 1)).trim();
    if (value && value.toLowerCase() !== 'null') fields.set(key, value);
  }
  return fields;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
