import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns errors as { statusCode, error, message }', () => {
    return request(app.getHttpServer())
      .get('/does-not-exist')
      .expect(404)
      .expect({
        statusCode: 404,
        error: 'Not Found',
        message: 'Cannot GET /does-not-exist',
      });
  });

  it('serves the OpenAPI document with the health route', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('UPI Expense Tracker API');
    expect(res.body.paths).toHaveProperty('/health');
  });
});
