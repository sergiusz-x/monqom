import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Res,
    UseGuards,
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import {
    CreateIntegrationCredentialDto,
    CredentialStepUpDto,
    DeletedIntegrationCredentialResponseDto,
    IntegrationResponseDto,
    IssuedIntegrationCredentialResponseDto,
    RevokedIntegrationCredentialResponseDto,
    RotateIntegrationCredentialDto,
    RotatedIntegrationCredentialResponseDto,
} from './integration-management.dto'
import { IntegrationManagementService } from './integration-management.service'
import { CurrentUserId, CurrentWorkspaceId } from '../../shared/http/request-context.decorator'

@Controller('workspaces/:workspaceId/integrations')
@ApiTags('integrations')
@ApiParam({ name: 'workspaceId' })
@UseGuards(SessionGuard, WorkspaceGuard, WorkspaceRoleGuard)
@RequireWorkspaceRole('admin')
export class IntegrationManagementController {
    constructor(private readonly managementService: IntegrationManagementService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({ type: IssuedIntegrationCredentialResponseDto })
    async create(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Body() body: CreateIntegrationCredentialDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        noStore(response)
        return this.managementService.create(workspaceId, userId, body)
    }

    @Get()
    @ApiOkResponse({ type: IntegrationResponseDto, isArray: true })
    async list(@CurrentWorkspaceId() workspaceId: string) {
        return this.managementService.list(workspaceId)
    }

    @Get(':integrationId')
    @ApiOkResponse({ type: IntegrationResponseDto })
    @ApiParam({ name: 'integrationId' })
    async get(
        @CurrentWorkspaceId() workspaceId: string,
        @Param('integrationId') integrationId: string,
    ) {
        return this.managementService.get(workspaceId, integrationId)
    }

    @Post(':integrationId/credentials/:credentialId/revoke')
    @ApiOkResponse({ type: RevokedIntegrationCredentialResponseDto })
    @ApiParam({ name: 'integrationId' })
    @ApiParam({ name: 'credentialId' })
    async revoke(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
        @Body() body: CredentialStepUpDto,
    ) {
        return this.managementService.revoke(workspaceId, userId, integrationId, credentialId, body)
    }

    @Post(':integrationId/credentials/:credentialId/rotate')
    @ApiOkResponse({ type: RotatedIntegrationCredentialResponseDto })
    @ApiParam({ name: 'integrationId' })
    @ApiParam({ name: 'credentialId' })
    async rotate(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
        @Body() body: RotateIntegrationCredentialDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        noStore(response)
        return this.managementService.rotate(workspaceId, userId, integrationId, credentialId, body)
    }

    @Delete(':integrationId/credentials/:credentialId')
    @ApiOkResponse({ type: DeletedIntegrationCredentialResponseDto })
    @ApiParam({ name: 'integrationId' })
    @ApiParam({ name: 'credentialId' })
    async remove(
        @CurrentWorkspaceId() workspaceId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
    ) {
        return this.managementService.remove(workspaceId, integrationId, credentialId)
    }
}

function noStore(response: Response) {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Pragma', 'no-cache')
}
