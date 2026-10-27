import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { EnvironmentVariables } from '../config/env.validation.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
}

@Injectable()
export class GoogleService {
  constructor(
    private readonly client: OAuth2Client,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async verify(idToken: string): Promise<GoogleProfile> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.get('GOOGLE_WEB_CLIENT_ID', { infer: true }),
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google account email is not verified');
    }
    return { sub: payload.sub, email: payload.email, name: payload.name };
  }
}
