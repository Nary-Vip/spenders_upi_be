import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import * as currentUserDecorator from './../src/common/decorators/current-user.decorator.js';
import { Public } from './../src/common/decorators/public.decorator.js';

@Controller('probe')
class ProbeController {
  @Get('private')
  whoAmI(
    @currentUserDecorator.CurrentUser() user: currentUserDecorator.AuthUser,
  ) {
    return user;
  }

  @Public()
  @Get('public')
  open() {
    return { open: true };
  }
}

describe('JwtAuthGuard (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('protects routes by default', () => {
    return request(app.getHttpServer())
      .get('/probe/private')
      .expect(401)
      .expect({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or invalid access token',
      });
  });

  it('gives the route the user from a valid access token', () => {
    const token = jwt.sign({ sub: 'user-42' });

    return request(app.getHttpServer())
      .get('/probe/private')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ id: 'user-42' });
  });

  it('lets @Public() routes through without a token', () => {
    return request(app.getHttpServer())
      .get('/probe/public')
      .expect(200)
      .expect({ open: true });
  });

  it('keeps /health public', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });
});
