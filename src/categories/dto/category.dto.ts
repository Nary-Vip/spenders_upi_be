import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  color: string;

  @ApiProperty({ description: 'Seeded at sign-up' })
  isDefault: boolean;
}
