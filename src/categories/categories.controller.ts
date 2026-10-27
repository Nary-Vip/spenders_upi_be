import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto } from './dto/category.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOkResponse({ type: [CategoryDto] })
  list(@CurrentUser() user: AuthUser): Promise<CategoryDto[]> {
    return this.categories.list(user.id);
  }

  @Post()
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiConflictResponse({ description: 'Name already used' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.create(user.id, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CategoryDto })
  @ApiNotFoundResponse({ description: 'No such category for this user' })
  @ApiConflictResponse({ description: 'Name already used' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Deleted; its payments keep no category',
  })
  @ApiNotFoundResponse({ description: 'No such category for this user' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.categories.remove(user.id, id);
  }
}
