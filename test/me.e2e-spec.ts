import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { TokenService } from './../src/auth/token.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('Me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  async function signedInUser() {
    const user = await prisma.user.create({
      data: { email: `me-${randomUUID()}@test.local`, name: 'Nary' },
    });
    userIds.push(user.id);
    const { accessToken } = await app.get(TokenService).issueTokens(user.id);
    return { user, auth: `Bearer ${accessToken}` };
  }

  it('requires an access token', () => {
    return request(app.getHttpServer()).get('/me').expect(401);
  });

  it('returns the profile with passkeys, without secret fields', async () => {
    const { user, auth } = await signedInUser();
    const passkey = await prisma.passkeyCredential.create({
      data: {
        userId: user.id,
        credentialId: randomUUID(),
        publicKey: new Uint8Array([1, 2, 3]),
        deviceName: 'Pixel 9',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', auth)
      .expect(200);

    expect(res.body).toEqual({
      id: user.id,
      email: user.email,
      name: 'Nary',
      createdAt: user.createdAt.toISOString(),
      passkeys: [
        {
          id: passkey.id,
          deviceName: 'Pixel 9',
          createdAt: passkey.createdAt.toISOString(),
          lastUsedAt: null,
        },
      ],
    });
  });

  it('returns 404 when the account no longer exists', async () => {
    const { user, auth } = await signedInUser();
    await prisma.user.delete({ where: { id: user.id } });

    await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', auth)
      .expect(404)
      .expect({
        statusCode: 404,
        error: 'Not Found',
        message: 'User not found',
      });
  });
});
