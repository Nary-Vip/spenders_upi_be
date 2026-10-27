import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { GoogleService } from './google.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }),
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    TokenService,
    GoogleService,
    { provide: OAuth2Client, useFactory: () => new OAuth2Client() },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
