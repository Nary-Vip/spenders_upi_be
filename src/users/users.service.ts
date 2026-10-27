import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '../generated/prisma/client.js';
import { isPrismaError, UNIQUE_VIOLATION } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_CATEGORIES } from './default-categories.js';
import { ProfileDto } from './dto/profile.dto.js';

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
      if (!isPrismaError(error, UNIQUE_VIOLATION)) {
        throw error;
      }
      const raced = await this.findByGoogleSub(account.sub);
      if (raced) {
        return { user: raced, isNewUser: false };
      }
      throw new ConflictException('An account with this email already exists');
    }
  }

  async getProfile(userId: string): Promise<ProfileDto> {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        passkeys: {
          select: {
            id: true,
            deviceName: true,
            createdAt: true,
            lastUsedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile;
  }

  private findByGoogleSub(googleSub: string) {
    return this.prisma.user.findUnique({ where: { googleSub } });
  }
}
