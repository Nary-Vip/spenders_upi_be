import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Fuel', maxLength: 40 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @ApiProperty({
    example: 'local_gas_station',
    description: 'Material Symbols icon name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  icon: string;

  @ApiProperty({ example: '#00897B' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a hex color like #F4511E',
  })
  color: string;
}
