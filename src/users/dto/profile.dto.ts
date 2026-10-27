import { ApiProperty } from '@nestjs/swagger';

export class PasskeyDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  deviceName: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  lastUsedAt: Date | null;
}

export class ProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, nullable: true })
  name: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [PasskeyDto] })
  passkeys: PasskeyDto[];
}
