import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { CreateIntegrationCredentialDto, CredentialStepUpDto } from './integration-management.dto'
import { IntegrationManagementService } from './integration-management.service'
import { CurrentUserId, CurrentWorkspaceId } from '../../shared/http/request-context.decorator'

@Controller('workspaces/:workspaceId/integrations')
@UseGuards(SessionGuard, WorkspaceGuard, WorkspaceRoleGuard)
@RequireWorkspaceRole('admin')
export class IntegrationManagementController {
    constructor(private readonly managementService: IntegrationManagementService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Body() body: CreateIntegrationCredentialDto,
    ) {
        return this.managementService.create(workspaceId, userId, body)
    }

    @Get()
    async list(@CurrentWorkspaceId() workspaceId: string) {
        return this.managementService.list(workspaceId)
    }

    @Get(':integrationId')
    async get(
        @CurrentWorkspaceId() workspaceId: string,
        @Param('integrationId') integrationId: string,
    ) {
        return this.managementService.get(workspaceId, integrationId)
    }

    @Post(':integrationId/credentials/:credentialId/revoke')
    async revoke(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
        @Body() body: CredentialStepUpDto,
    ) {
        return this.managementService.revoke(
            workspaceId,
            userId,
            integrationId,
            credentialId,
            body,
        )
    }

    @Post(':integrationId/credentials/:credentialId/rotate')
    async rotate(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
        @Body() body: CreateIntegrationCredentialDto,
    ) {
        return this.managementService.rotate(
            workspaceId,
            userId,
            integrationId,
            credentialId,
            body,
        )
    }

    @Delete(':integrationId/credentials/:credentialId')
    async remove(
        @CurrentWorkspaceId() workspaceId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
    ) {
        return this.managementService.remove(
            workspaceId,
            integrationId,
            credentialId,
        )
    }
}
