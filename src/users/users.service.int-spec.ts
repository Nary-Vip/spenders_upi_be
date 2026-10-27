import { ConflictException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { validateEnv } from '../config/env.validation.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_CATEGORIES } from './default-categories.js';
import { UsersModule } from './users.module.js';
import { UsersService } from './users.service.js';

describe('UsersService (integration)', () => {
  let module: TestingModule;
  let users: UsersService;
  let prisma: PrismaService;
  const emails: string[] = [];

  const profile = () => {
    const email = `users-${randomUUID()}@test.local`;
    emails.push(email);
    return { sub: `google-${randomUUID()}`, email, name: 'Test User' };
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        UsersModule,
      ],
    }).compile();
    await module.init();

    users = module.get(UsersService);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await module.close();
  });

  describe('findOrCreateFromGoogle', () => {
    it('creates a new user with the default categories', async () => {
      const google = profile();

      const { user, isNewUser } = await users.findOrCreateFromGoogle(google);

      expect(isNewUser).toBe(true);
      expect(user).toMatchObject({
        email: google.email,
        name: 'Test User',
        googleSub: google.sub,
      });
      const categories = await prisma.category.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      });
      expect(categories.map((c) => c.name)).toEqual(
        DEFAULT_CATEGORIES.map((c) => c.name).sort(),
      );
      expect(categories.every((c) => c.isDefault)).toBe(true);
    });

    it('returns the existing user on the next sign-in', async () => {
      const google = profile();
      const first = await users.findOrCreateFromGoogle(google);

      const second = await users.findOrCreateFromGoogle(google);

      expect(second.isNewUser).toBe(false);
      expect(second.user.id).toBe(first.user.id);
      await expect(
        prisma.category.count({ where: { userId: first.user.id } }),
      ).resolves.toBe(DEFAULT_CATEGORIES.length);
    });

    it('creates only one user when the first sign-in arrives twice at once', async () => {
      const google = profile();

      const results = await Promise.all([
        users.findOrCreateFromGoogle(google),
        users.findOrCreateFromGoogle(google),
      ]);

      expect(results[0].user.id).toBe(results[1].user.id);
      expect(results.filter((r) => r.isNewUser)).toHaveLength(1);
      await expect(
        prisma.user.count({ where: { googleSub: google.sub } }),
      ).resolves.toBe(1);
    });

    it('refuses a second Google account with an email already in use', async () => {
      const google = profile();
      await users.findOrCreateFromGoogle(google);

      await expect(
        users.findOrCreateFromGoogle({
          ...google,
          sub: `google-${randomUUID()}`,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
