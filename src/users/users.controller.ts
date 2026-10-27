import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { ProfileDto } from './dto/profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: ProfileDto })
  @ApiNotFoundResponse({ description: 'Account no longer exists' })
  getProfile(@CurrentUser() user: AuthUser): Promise<ProfileDto> {
    return this.users.getProfile(user.id);
  }
}
