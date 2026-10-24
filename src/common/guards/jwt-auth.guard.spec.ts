import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 's'.repeat(32) });
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(jwt, reflector);

  class Routes {
    open() {}
    closed() {}
  }
  Reflect.defineMetadata(IS_PUBLIC_KEY, true, Routes.prototype.open);

  function contextFor(
    handler: () => void,
    headers: Record<string, string> = {},
  ) {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers,
    };
    const context = {
      getHandler: () => handler,
      getClass: () => Routes,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('lets a @Public() route through without a token', async () => {
    const { context } = contextFor(Routes.prototype.open);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a request without an Authorization header', async () => {
    const { context } = contextFor(Routes.prototype.closed);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const token = await jwt.signAsync({ sub: 'user-1' });
    const { context } = contextFor(Routes.prototype.closed, {
      authorization: `Basic ${token}`,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({ secret: 'x'.repeat(32) }).signAsync({
      sub: 'user-1',
    });
    const { context } = contextFor(Routes.prototype.closed, {
      authorization: `Bearer ${forged}`,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const expired = await jwt.signAsync(
      { sub: 'user-1' },
      { expiresIn: '-10s' },
    );
    const { context } = contextFor(Routes.prototype.closed, {
      authorization: `Bearer ${expired}`,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid token and attaches the user to the request', async () => {
    const token = await jwt.signAsync({ sub: 'user-1' });
    const { context, request } = contextFor(Routes.prototype.closed, {
      authorization: `Bearer ${token}`,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1' });
  });
});
