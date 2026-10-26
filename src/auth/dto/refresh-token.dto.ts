import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token from sign-in or the last refresh',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
