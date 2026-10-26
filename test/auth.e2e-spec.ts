import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { TokenService } from './../src/auth/token.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: TokenService;
  let jwt: JwtService;
  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    jwt = app.get(JwtService, { strict: false });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  async function signedInUser() {
    const user = await prisma.user.create({
      data: { email: `auth-${randomUUID()}@test.local` },
    });
    userIds.push(user.id);
    return { userId: user.id, ...(await tokens.issueTokens(user.id)) };
  }

  describe('POST /auth/refresh', () => {
    it('returns a new token pair', async () => {
      const { userId, refreshToken } = await signedInUser();

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(Object.keys(res.body).sort()).toEqual([
        'accessToken',
        'refreshToken',
      ]);
      expect(res.body.refreshToken).not.toBe(refreshToken);
      const payload = await jwt.verifyAsync(res.body.accessToken);
      expect(payload.sub).toBe(userId);
    });

    it('rejects a refresh token that was already used', async () => {
      const { refreshToken } = await signedInUser();
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('rejects an unknown refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(401);
    });

    it('returns 400 with every validation message when the body is empty', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400)
        .expect({
          statusCode: 400,
          error: 'Bad Request',
          message: [
            'refreshToken should not be empty',
            'refreshToken must be a string',
          ],
        });
    });

    it('returns 400 for fields the endpoint does not accept', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'abc', userId: 'someone-else' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            'property userId should not exist',
          ]);
        });
    });
  });

  describe('POST /auth/logout', () => {
    it('requires an access token', async () => {
      const { refreshToken } = await signedInUser();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(401);
    });

    it('revokes the refresh token and returns 204', async () => {
      const { accessToken, refreshToken } = await signedInUser();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204)
        .expect('');

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
