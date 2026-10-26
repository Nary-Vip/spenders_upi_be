import { UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import { validateEnv } from '../config/env.validation.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from './auth.module.js';
import { TokenService } from './token.service.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('TokenService (integration)', () => {
  let module: TestingModule;
  let tokens: TokenService;
  let jwt: JwtService;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        AuthModule,
      ],
    }).compile();
    await module.init();

    tokens = module.get(TokenService);
    jwt = module.get(JwtService);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `token-${randomUUID()}@test.local` },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  afterAll(async () => {
    await module.close();
  });

  describe('issueTokens', () => {
    it('signs an access token whose subject is the user', async () => {
      const { accessToken } = await tokens.issueTokens(userId);

      const payload = await jwt.verifyAsync<{ sub: string }>(accessToken);
      expect(payload.sub).toBe(userId);
    });

    it('stores only the SHA-256 hash of the refresh token', async () => {
      const { refreshToken } = await tokens.issueTokens(userId);

      const rows = await prisma.refreshToken.findMany({ where: { userId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(sha256(refreshToken));
      expect(rows[0].tokenHash).not.toBe(refreshToken);
    });

    it('expires the refresh token after REFRESH_TTL_DAYS', async () => {
      await tokens.issueTokens(userId);

      const row = await prisma.refreshToken.findFirstOrThrow({
        where: { userId },
      });
      const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
    });
  });

  describe('rotate', () => {
    it('revokes the old refresh token and links it to the new one', async () => {
      const first = await tokens.issueTokens(userId);

      const second = await tokens.rotate(first.refreshToken);

      expect(second.userId).toBe(userId);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      const oldRow = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: sha256(first.refreshToken) },
      });
      const newRow = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: sha256(second.refreshToken) },
      });
      expect(oldRow.revokedAt).not.toBeNull();
      expect(oldRow.replacedById).toBe(newRow.id);
      expect(newRow.familyId).toBe(oldRow.familyId);
      expect(newRow.revokedAt).toBeNull();
    });

    it('lets the new refresh token rotate again', async () => {
      const first = await tokens.issueTokens(userId);
      const second = await tokens.rotate(first.refreshToken);

      await expect(tokens.rotate(second.refreshToken)).resolves.toMatchObject({
        userId,
      });
    });

    it('rejects an unknown refresh token', async () => {
      await expect(tokens.rotate('not-a-real-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired refresh token', async () => {
      const { refreshToken } = await tokens.issueTokens(userId);
      await prisma.refreshToken.update({
        where: { tokenHash: sha256(refreshToken) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(tokens.rotate(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the whole family when a used token is presented again', async () => {
      const first = await tokens.issueTokens(userId);
      const second = await tokens.rotate(first.refreshToken);

      await expect(tokens.rotate(first.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(tokens.rotate(second.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('leaves other sign-ins of the same user alone on reuse', async () => {
      const phone = await tokens.issueTokens(userId);
      const tablet = await tokens.issueTokens(userId);
      await tokens.rotate(phone.refreshToken);

      await expect(tokens.rotate(phone.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(tokens.rotate(tablet.refreshToken)).resolves.toMatchObject({
        userId,
      });
    });

    it('treats two concurrent rotations of one token as reuse', async () => {
      const { refreshToken } = await tokens.issueTokens(userId);

      const results = await Promise.allSettled([
        tokens.rotate(refreshToken),
        tokens.rotate(refreshToken),
      ]);

      const won = results.filter((r) => r.status === 'fulfilled');
      expect(won).toHaveLength(1);
      const active = await prisma.refreshToken.count({
        where: { userId, revokedAt: null },
      });
      expect(active).toBe(0);
    });
  });

  describe('revoke', () => {
    it('makes the refresh token unusable', async () => {
      const { refreshToken } = await tokens.issueTokens(userId);

      await tokens.revoke(refreshToken, userId);

      await expect(tokens.rotate(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('ignores an unknown token', async () => {
      await expect(
        tokens.revoke('not-a-real-token', userId),
      ).resolves.toBeUndefined();
    });

    it("does not revoke another user's token", async () => {
      const other = await prisma.user.create({
        data: { email: `token-${randomUUID()}@test.local` },
      });
      try {
        const { refreshToken } = await tokens.issueTokens(other.id);

        await tokens.revoke(refreshToken, userId);

        await expect(tokens.rotate(refreshToken)).resolves.toMatchObject({
          userId: other.id,
        });
      } finally {
        await prisma.user.delete({ where: { id: other.id } });
      }
    });
  });
});
