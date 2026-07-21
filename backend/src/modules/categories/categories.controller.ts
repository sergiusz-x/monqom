import { Controller, Get, HttpCode, HttpStatus, Param, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { CATEGORIES_BASE_ROUTE } from './categories.routes'
import { CategoriesService, CategoryResponse } from './categories.service'
import { CategoriesQueryDto } from './categories.dto'

@Controller(CATEGORIES_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listCategories(
        @Query() query: CategoriesQueryDto,
        @Req() req: Request,
    ): Promise<CategoryResponse[]> {
        return this.categoriesService.listCategories(
            { includeArchived: query.include_archived },
            req.workspace!.workspaceId,
        )
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async getCategory(
        @Param('id') categoryId: string,
        @Query() query: CategoriesQueryDto,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.getCategoryById(
            categoryId,
            { includeArchived: query.include_archived },
            req.workspace!.workspaceId,
        )
    }
}
