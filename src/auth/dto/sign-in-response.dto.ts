import { ApiProperty } from '@nestjs/swagger';
import { TokenPairDto } from './token-pair.dto.js';

export class SignedInUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, nullable: true })
  name: string | null;
}

export class SignInResponseDto extends TokenPairDto {
  @ApiProperty({ type: SignedInUserDto })
  user: SignedInUserDto;

  @ApiProperty({ description: 'True when this sign-in created the account' })
  isNewUser: boolean;
}
