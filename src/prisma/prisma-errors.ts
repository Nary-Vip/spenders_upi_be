import { Prisma } from '../generated/prisma/client.js';

export const UNIQUE_VIOLATION = 'P2002';
export const RECORD_NOT_FOUND = 'P2025';

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
