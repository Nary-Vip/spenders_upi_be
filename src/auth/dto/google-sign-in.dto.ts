import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleSignInDto {
  @ApiProperty({
    description: 'ID token from Credential Manager (Sign in with Google)',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
