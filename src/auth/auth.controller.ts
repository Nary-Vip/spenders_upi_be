import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { UsersService } from '../users/users.service.js';
import { GoogleSignInDto } from './dto/google-sign-in.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { SignInResponseDto } from './dto/sign-in-response.dto.js';
import { TokenPairDto } from './dto/token-pair.dto.js';
import { GoogleService } from './google.service.js';
import { TokenService } from './token.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokens: TokenService,
    private readonly google: GoogleService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SignInResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Invalid or unverified Google token',
  })
  @ApiConflictResponse({ description: 'Email belongs to another account' })
  async signInWithGoogle(
    @Body() body: GoogleSignInDto,
  ): Promise<SignInResponseDto> {
    const account = await this.google.verify(body.idToken);
    const { user, isNewUser } =
      await this.users.findOrCreateFromGoogle(account);
    const tokens = await this.tokens.issueTokens(user.id);
    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
      isNewUser,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired or reused token' })
  async refresh(@Body() body: RefreshTokenDto): Promise<TokenPairDto> {
    const { accessToken, refreshToken } = await this.tokens.rotate(
      body.refreshToken,
    );
    return { accessToken, refreshToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Refresh token revoked' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() body: RefreshTokenDto,
  ): Promise<void> {
    await this.tokens.revoke(body.refreshToken, user.id);
  }
}
