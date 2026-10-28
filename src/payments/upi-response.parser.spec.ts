import { parseUpiResponse } from './upi-response.parser.js';

describe('parseUpiResponse', () => {
  describe('fixtures from UPI apps', () => {
    it.each([
      {
        app: 'success with all fields',
        raw: 'txnId=AXI123456&responseCode=00&Status=SUCCESS&txnRef=ref-1&ApprovalRefNo=412345678901',
        expected: {
          status: 'AWAITING_CONFIRMATION',
          upiTxnId: 'AXI123456',
          upiRef: '412345678901',
        },
      },
      {
        app: 'lower-case keys and value',
        raw: 'txnid=YBL987&responsecode=00&status=success&approvalrefno=498765432109',
        expected: {
          status: 'AWAITING_CONFIRMATION',
          upiTxnId: 'YBL987',
          upiRef: '498765432109',
        },
      },
      {
        app: 'failure',
        raw: 'txnId=ICI555&responseCode=ZD&Status=FAILURE&txnRef=ref-2',
        expected: { status: 'FAILED', upiTxnId: 'ICI555' },
      },
      {
        app: 'failure spelled FAILED',
        raw: 'Status=FAILED&txnId=PTM42',
        expected: { status: 'FAILED', upiTxnId: 'PTM42' },
      },
      {
        app: 'submitted, final state unknown',
        raw: 'txnId=SBI77&Status=SUBMITTED',
        expected: { status: 'AWAITING_CONFIRMATION', upiTxnId: 'SBI77' },
      },
      {
        app: 'URL-encoded values',
        raw: 'txnId=ABC%2F123&Status=SUCCESS&ApprovalRefNo=4123%20456',
        expected: {
          status: 'AWAITING_CONFIRMATION',
          upiTxnId: 'ABC/123',
          upiRef: '4123 456',
        },
      },
      {
        app: 'literal "null" and empty values',
        raw: 'txnId=&Status=SUCCESS&ApprovalRefNo=null',
        expected: { status: 'AWAITING_CONFIRMATION' },
      },
    ])('$app', ({ raw, expected }) => {
      expect(parseUpiResponse(raw)).toEqual(expected);
    });
  });

  it('treats an empty response as awaiting confirmation', () => {
    expect(parseUpiResponse('')).toEqual({ status: 'AWAITING_CONFIRMATION' });
  });

  it('treats a response without Status as awaiting confirmation', () => {
    expect(parseUpiResponse('txnId=X1&responseCode=00')).toEqual({
      status: 'AWAITING_CONFIRMATION',
      upiTxnId: 'X1',
    });
  });

  it('does not throw on malformed percent-encoding', () => {
    expect(parseUpiResponse('txnId=%E0%A4%A&Status=FAILURE')).toEqual({
      status: 'FAILED',
      upiTxnId: '%E0%A4%A',
    });
  });

  it('never reports CONFIRMED', () => {
    expect(
      parseUpiResponse('Status=CONFIRMED&responseCode=00').status,
    ).not.toBe('CONFIRMED');
  });
});
