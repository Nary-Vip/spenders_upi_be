import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty({ description: 'JWT for the Authorization header, ~15 min' })
  accessToken: string;

  @ApiProperty({ description: 'Single-use token for /auth/refresh, ~30 days' })
  refreshToken: string;
}
