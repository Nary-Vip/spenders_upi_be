import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleService } from './google.service.js';

describe('GoogleService', () => {
  const client = { verifyIdToken: vi.fn() };
  let google: GoogleService;

  const ticketWith = (payload: Partial<TokenPayload>) => ({
    getPayload: () => payload,
  });

  beforeEach(async () => {
    client.verifyIdToken.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        GoogleService,
        { provide: OAuth2Client, useValue: client },
        {
          provide: ConfigService,
          useValue: { get: () => 'web-client-id.apps.googleusercontent.com' },
        },
      ],
    }).compile();

    google = module.get(GoogleService);
  });

  it('returns the profile of a verified Google account', async () => {
    client.verifyIdToken.mockResolvedValue(
      ticketWith({
        sub: 'google-123',
        email: 'nary@example.com',
        email_verified: true,
        name: 'Nary',
      }),
    );

    await expect(google.verify('id-token')).resolves.toEqual({
      sub: 'google-123',
      email: 'nary@example.com',
      name: 'Nary',
    });
    expect(client.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      audience: 'web-client-id.apps.googleusercontent.com',
    });
  });

  it('rejects a token Google does not accept', async () => {
    client.verifyIdToken.mockRejectedValue(new Error('Wrong recipient'));

    await expect(google.verify('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an account whose email is not verified', async () => {
    client.verifyIdToken.mockResolvedValue(
      ticketWith({
        sub: 'google-123',
        email: 'nary@example.com',
        email_verified: false,
      }),
    );

    await expect(google.verify('id-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token without an email', async () => {
    client.verifyIdToken.mockResolvedValue(
      ticketWith({ sub: 'google-123', email_verified: true }),
    );

    await expect(google.verify('id-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
