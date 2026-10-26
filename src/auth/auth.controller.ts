import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { TokenPairDto } from './dto/token-pair.dto.js';
import { TokenService } from './token.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly tokens: TokenService) {}

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
