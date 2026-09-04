import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { CreateIntegrationCredentialDto, CredentialStepUpDto } from './integration-management.dto'
import { IntegrationManagementService } from './integration-management.service'

@Controller('workspaces/:workspaceId/integrations')
@UseGuards(SessionGuard, WorkspaceGuard, WorkspaceRoleGuard)
@RequireWorkspaceRole('admin')
export class IntegrationManagementController {
    constructor(private readonly managementService: IntegrationManagementService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Req() req: Request, @Body() body: CreateIntegrationCredentialDto) {
        return this.managementService.create(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            body,
        )
    }

    @Get()
    async list(@Req() req: Request) {
        return this.managementService.list(req.workspace!.workspaceId)
    }

    @Get(':integrationId')
    async get(@Req() req: Request, @Param('integrationId') integrationId: string) {
        return this.managementService.get(req.workspace!.workspaceId, integrationId)
    }

    @Post(':integrationId/credentials/:credentialId/revoke')
    async revoke(
        @Req() req: Request,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
        @Body() body: CredentialStepUpDto,
    ) {
        return this.managementService.revoke(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            integrationId,
            credentialId,
            body,
        )
    }

    @Post(':integrationId/credentials/:credentialId/rotate')
    async rotate(
        @Req() req: Request,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
        @Body() body: CreateIntegrationCredentialDto,
    ) {
        return this.managementService.rotate(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            integrationId,
            credentialId,
            body,
        )
    }

    @Delete(':integrationId/credentials/:credentialId')
    async remove(
        @Req() req: Request,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
    ) {
        return this.managementService.remove(
            req.workspace!.workspaceId,
            integrationId,
            credentialId,
        )
    }
}
