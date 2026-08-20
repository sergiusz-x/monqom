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
import { ApiParam } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { CATEGORIES_BASE_ROUTE } from './categories.routes'
import { CategoriesService, CategoryResponse } from './categories.service'
import { CategoriesQueryDto, CategoryBodyDto, CategoryOrderBodyDto } from './categories.dto'
import { ApiCategoryResponse } from '../../shared/openapi/response-schemas'
@Controller(CATEGORIES_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiParam({ name: 'workspaceId', type: String })
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) {}
    @Get() @ApiCategoryResponse(true) @HttpCode(HttpStatus.OK) async listCategories(
        @Query() query: CategoriesQueryDto,
        @Req() req: Request,
    ): Promise<CategoryResponse[]> {
        return this.categoriesService.listCategories(
            { includeArchived: query.include_archived, type: query.type },
            req.workspace!.workspaceId,
        )
    }
    @Get(':id') @ApiCategoryResponse() @HttpCode(HttpStatus.OK) async getCategory(
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
    @Post()
    @ApiCategoryResponse(false, HttpStatus.CREATED)
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.CREATED)
    async createCategory(
        @Body() body: CategoryBodyDto,
        @Req() req: Request,
    ): Promise<CategoryResponse> {
        return this.categoriesService.createCategory(
            body,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
    @Patch(':id')
    @ApiCategoryResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    async updateCategory(
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
    @Put('order')
    @ApiCategoryResponse(true)
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    async reorderCategories(
        @Body() body: CategoryOrderBodyDto,
        @Req() req: Request,
    ): Promise<CategoryResponse[]> {
        return this.categoriesService.reorderCategories(
            body.items,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
    @Post(':id/archive')
    @ApiCategoryResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    async archiveCategory(@Param('id') id: string, @Req() req: Request): Promise<CategoryResponse> {
        return this.categoriesService.archiveCategory(
            id,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
    @Post(':id/restore')
    @ApiCategoryResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    async restoreCategory(@Param('id') id: string, @Req() req: Request): Promise<CategoryResponse> {
        return this.categoriesService.restoreCategory(
            id,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
}
