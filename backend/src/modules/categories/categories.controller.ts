import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { CATEGORIES_BASE_ROUTE } from './categories.routes'
import { CategoriesService, CategoryResponse } from './categories.service'
import { CategoriesQueryDto, CategoryBodyDto, CategoryOrderBodyDto } from './categories.dto'
@Controller(CATEGORIES_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}
    @Get() @HttpCode(HttpStatus.OK) async listCategories(
        @Query() query: CategoriesQueryDto,
        @Req() req: Request,
    ): Promise<CategoryResponse[]> {
        return this.categoriesService.listCategories(
            { includeArchived: query.include_archived, type: query.type },
            req.workspace!.workspaceId,
        )
    }
    @Get(':id') @HttpCode(HttpStatus.OK) async getCategory(
        @Param('id') id: string,
        @Query() query: CategoriesQueryDto,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.getCategoryById(
            id,
            { includeArchived: query.include_archived, type: query.type },
            req.workspace!.workspaceId,
        )
    }
    @Post() @HttpCode(HttpStatus.CREATED) async createCategory(
        @Body() body: CategoryBodyDto,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.createCategory(
            body,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
    @Patch(':id') async updateCategory(
        @Param('id') id: string,
        @Body() body: CategoryBodyDto,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.updateCategory(
            id,
            body,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
    @Put('order') async reorderCategories(
        @Body() body: CategoryOrderBodyDto,
        @Req() req: Request,
    ): Promise<CategoryResponse[]> {
        return this.categoriesService.reorderCategories(body.items, req.workspace!.workspaceId)
    }
    @Post(':id/archive') async archiveCategory(
        @Param('id') id: string,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.archiveCategory(
            id,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
    @Post(':id/restore') async restoreCategory(
        @Param('id') id: string,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.restoreCategory(
            id,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
}
