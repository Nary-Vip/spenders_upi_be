import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { TokenService } from './../src/auth/token.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { DEFAULT_CATEGORIES } from './../src/users/default-categories.js';
import { UsersService } from './../src/users/users.service.js';

describe('Categories (e2e)', () => {
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
    const { user } = await app.get(UsersService).findOrCreateFromGoogle({
      sub: `google-${randomUUID()}`,
      email: `categories-${randomUUID()}@test.local`,
    });
    userIds.push(user.id);
    const { accessToken } = await app.get(TokenService).issueTokens(user.id);
    return { userId: user.id, auth: `Bearer ${accessToken}` };
  }

  const http = () => request(app.getHttpServer());

  async function categoryOf(userId: string, name: string) {
    return prisma.category.findFirstOrThrow({ where: { userId, name } });
  }

  describe('GET /categories', () => {
    it('requires an access token', () => {
      return http().get('/categories').expect(401);
    });

    it("lists only the user's own categories, sorted by name", async () => {
      const { auth } = await signedInUser();
      await signedInUser();

      const res = await http()
        .get('/categories')
        .set('Authorization', auth)
        .expect(200);

      expect(res.body.map((c: { name: string }) => c.name)).toEqual(
        DEFAULT_CATEGORIES.map((c) => c.name).sort(),
      );
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        name: 'Bills',
        icon: 'receipt_long',
        color: '#8E24AA',
        isDefault: true,
      });
    });
  });

  describe('POST /categories', () => {
    it('creates a category and returns 201', async () => {
      const { userId, auth } = await signedInUser();

      const res = await http()
        .post('/categories')
        .set('Authorization', auth)
        .send({ name: '  Fuel ', icon: 'local_gas_station', color: '#00897B' })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'Fuel',
        icon: 'local_gas_station',
        color: '#00897B',
        isDefault: false,
      });
      await expect(categoryOf(userId, 'Fuel')).resolves.toMatchObject({
        id: res.body.id,
      });
    });

    it('returns 409 when the name is already used', async () => {
      const { auth } = await signedInUser();

      await http()
        .post('/categories')
        .set('Authorization', auth)
        .send({ name: 'Food', icon: 'restaurant', color: '#000000' })
        .expect(409)
        .expect({
          statusCode: 409,
          error: 'Conflict',
          message: 'A category with this name already exists',
        });
    });

    it('returns 400 for an invalid body', async () => {
      const { auth } = await signedInUser();

      const res = await http()
        .post('/categories')
        .set('Authorization', auth)
        .send({ name: '   ', icon: 'x', color: 'red', isDefault: true })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'property isDefault should not exist',
          'name should not be empty',
          'color must be a hex color like #F4511E',
        ]),
      );
    });
  });

  describe('PATCH /categories/:id', () => {
    it('updates only the fields that are sent', async () => {
      const { userId, auth } = await signedInUser();
      const food = await categoryOf(userId, 'Food');

      const res = await http()
        .patch(`/categories/${food.id}`)
        .set('Authorization', auth)
        .send({ color: '#123456' })
        .expect(200);

      expect(res.body).toEqual({
        id: food.id,
        name: 'Food',
        icon: 'restaurant',
        color: '#123456',
        isDefault: true,
      });
    });

    it('returns 409 when renaming to a name that is already used', async () => {
      const { userId, auth } = await signedInUser();
      const food = await categoryOf(userId, 'Food');

      await http()
        .patch(`/categories/${food.id}`)
        .set('Authorization', auth)
        .send({ name: 'Travel' })
        .expect(409);
    });

    it("returns 404 for another user's category and leaves it unchanged", async () => {
      const owner = await signedInUser();
      const other = await signedInUser();
      const food = await categoryOf(owner.userId, 'Food');

      await http()
        .patch(`/categories/${food.id}`)
        .set('Authorization', other.auth)
        .send({ name: 'Hacked' })
        .expect(404)
        .expect({
          statusCode: 404,
          error: 'Not Found',
          message: 'Category not found',
        });

      await expect(categoryOf(owner.userId, 'Food')).resolves.toBeDefined();
    });

    it('returns 400 when the id is not a UUID', async () => {
      const { auth } = await signedInUser();

      await http()
        .patch('/categories/not-a-uuid')
        .set('Authorization', auth)
        .send({ name: 'Anything' })
        .expect(400);
    });
  });

  describe('DELETE /categories/:id', () => {
    it('deletes the category, unlinks its payments and drops its payee rules', async () => {
      const { userId, auth } = await signedInUser();
      const food = await categoryOf(userId, 'Food');
      const payment = await prisma.payment.create({
        data: {
          userId,
          categoryId: food.id,
          payeeVpa: 'cafe@upi',
          rawQr: 'upi://pay?pa=cafe@upi',
          idempotencyKey: randomUUID(),
        },
      });
      await prisma.payeeRule.create({
        data: { userId, vpa: 'cafe@upi', categoryId: food.id },
      });

      await http()
        .delete(`/categories/${food.id}`)
        .set('Authorization', auth)
        .expect(204)
        .expect('');

      await expect(
        prisma.category.findUnique({ where: { id: food.id } }),
      ).resolves.toBeNull();
      await expect(
        prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).resolves.toMatchObject({ categoryId: null });
      await expect(prisma.payeeRule.count({ where: { userId } })).resolves.toBe(
        0,
      );
    });

    it("returns 404 for another user's category and keeps it", async () => {
      const owner = await signedInUser();
      const other = await signedInUser();
      const food = await categoryOf(owner.userId, 'Food');
      await prisma.payeeRule.create({
        data: { userId: owner.userId, vpa: 'cafe@upi', categoryId: food.id },
      });

      await http()
        .delete(`/categories/${food.id}`)
        .set('Authorization', other.auth)
        .expect(404);

      await expect(categoryOf(owner.userId, 'Food')).resolves.toBeDefined();
      await expect(
        prisma.payeeRule.count({ where: { userId: owner.userId } }),
      ).resolves.toBe(1);
    });

    it('returns 404 for an unknown id', async () => {
      const { auth } = await signedInUser();

      await http()
        .delete(`/categories/${randomUUID()}`)
        .set('Authorization', auth)
        .expect(404);
    });
  });
});
