import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { GoogleService } from './../src/auth/google.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('POST /auth/google (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  const google = { verify: vi.fn() };
  const emails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleService)
      .useValue(google)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService, { strict: false });
  });

  beforeEach(() => {
    google.verify.mockReset();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  function googleAccount() {
    const email = `google-${randomUUID()}@test.local`;
    emails.push(email);
    return { sub: `google-${randomUUID()}`, email, name: 'Nary' };
  }

  it('signs up a new user and returns app tokens', async () => {
    const account = googleAccount();
    google.verify.mockResolvedValue(account);

    const res = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'google-id-token' })
      .expect(200);

    expect(google.verify).toHaveBeenCalledWith('google-id-token');
    expect(res.body).toMatchObject({
      isNewUser: true,
      user: { email: account.email, name: 'Nary' },
    });
    expect(Object.keys(res.body.user).sort()).toEqual(['email', 'id', 'name']);
    expect(typeof res.body.refreshToken).toBe('string');
    const payload = await jwt.verifyAsync(res.body.accessToken);
    expect(payload.sub).toBe(res.body.user.id);
  });

  it('signs in an existing user', async () => {
    const account = googleAccount();
    google.verify.mockResolvedValue(account);
    const first = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'google-id-token' })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'google-id-token' })
      .expect(200);

    expect(second.body.isNewUser).toBe(false);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('returns 401 when Google rejects the token', () => {
    google.verify.mockRejectedValue(
      new UnauthorizedException('Invalid Google ID token'),
    );

    return request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'forged' })
      .expect(401)
      .expect({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid Google ID token',
      });
  });

  it('returns 400 without an idToken', () => {
    return request(app.getHttpServer())
      .post('/auth/google')
      .send({})
      .expect(400);
  });
});
