import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RotatedTokens extends TokenPair {
  userId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async issueTokens(userId: string): Promise<TokenPair> {
    const refresh = this.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        id: refresh.id,
        userId,
        familyId: randomUUID(),
        tokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
      },
    });
    return {
      accessToken: await this.signAccessToken(userId),
      refreshToken: refresh.token,
    };
  }

  async rotate(refreshToken: string): Promise<RotatedTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
    });
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const next = this.newRefreshToken();
    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
      if (claimed.count === 0) {
        return false;
      }
      await tx.refreshToken.create({
        data: {
          id: next.id,
          userId: stored.userId,
          familyId: stored.familyId,
          tokenHash: next.hash,
          expiresAt: next.expiresAt,
        },
      });
      return true;
    });

    if (!rotated) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return {
      userId: stored.userId,
      accessToken: await this.signAccessToken(stored.userId),
      refreshToken: next.token,
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(userId: string) {
    return this.jwt.signAsync({ sub: userId });
  }

  private newRefreshToken() {
    const token = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    return {
      id: randomUUID(),
      token,
      hash: this.hash(token),
      expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
    };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
