import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isPrismaError,
  RECORD_NOT_FOUND,
  UNIQUE_VIOLATION,
} from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CategoryDto } from './dto/category.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const CATEGORY_FIELDS = {
  id: true,
  name: true,
  icon: true,
  color: true,
  isDefault: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({
      where: { userId },
      select: CATEGORY_FIELDS,
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    try {
      return await this.prisma.category.create({
        data: { userId, name: dto.name, icon: dto.icon, color: dto.color },
        select: CATEGORY_FIELDS,
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    try {
      return await this.prisma.category.update({
        where: { id, userId },
        data: dto,
        select: CATEGORY_FIELDS,
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.payeeRule.deleteMany({ where: { userId, categoryId: id } }),
        this.prisma.category.delete({ where: { id, userId } }),
      ]);
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): unknown {
    if (isPrismaError(error, UNIQUE_VIOLATION)) {
      return new ConflictException('A category with this name already exists');
    }
    if (isPrismaError(error, RECORD_NOT_FOUND)) {
      return new NotFoundException('Category not found');
    }
    return error;
  }
}
