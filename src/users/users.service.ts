import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_CATEGORIES } from './default-categories.js';

export interface GoogleAccount {
  sub: string;
  email: string;
  name?: string;
}

export interface SignInResult {
  user: User;
  isNewUser: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromGoogle(account: GoogleAccount): Promise<SignInResult> {
    const existing = await this.findByGoogleSub(account.sub);
    if (existing) {
      return { user: existing, isNewUser: false };
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: account.email,
          name: account.name,
          googleSub: account.sub,
          categories: {
            createMany: {
              data: DEFAULT_CATEGORIES.map((c) => ({ ...c, isDefault: true })),
            },
          },
        },
      });
      return { user, isNewUser: true };
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
      const raced = await this.findByGoogleSub(account.sub);
      if (raced) {
        return { user: raced, isNewUser: false };
      }
      throw new ConflictException('An account with this email already exists');
    }
  }

  private findByGoogleSub(googleSub: string) {
    return this.prisma.user.findUnique({ where: { googleSub } });
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
