import { Controller, Get, HttpCode, HttpStatus, Param, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { CATEGORIES_BASE_ROUTE } from './categories.routes'
import { CategoriesService, CategoryResponse } from './categories.service'

@Controller(CATEGORIES_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listCategories(@Req() req: Request): Promise<CategoryResponse[]> {
        return this.categoriesService.listCategories(
            req.query as Record<string, unknown>,
            req.workspace!.workspaceId,
        )
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async getCategory(
        @Param('id') categoryId: string,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.getCategoryById(
            categoryId,
            req.query as Record<string, unknown>,
            req.workspace!.workspaceId,
        )
    }
}
