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
    UseInterceptors,
} from '@nestjs/common'
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
    ApiTooManyRequestsResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { RequireWorkspaceRole } from '../../shared/guards/workspace-role.guard'
import { SESSION_COOKIE_NAME } from '../../shared/session/session.config'
import { IntegrationManagementAction } from './integration-management-audit.service'
import { IntegrationManagementGuard } from './integration-management.guard'
import { IntegrationManagementInterceptor } from './integration-management.interceptor'
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
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiUnauthorizedResponse({
    description: 'Missing/invalid human session, or incorrect password / required second factor.',
})
@ApiForbiddenResponse({
    description: 'Workspace member lacks owner/admin role, or mutation has an invalid CSRF token.',
})
@ApiNotFoundResponse({
    description:
        'Workspace is missing or inaccessible, or target integration/credential is missing, foreign or safely deleted.',
})
@ApiBadRequestResponse({
    description: 'Invalid/unknown DTO fields, scopes, expiry, CIDRs, or resource policy.',
})
@ApiConflictResponse({
    description: 'Concurrent lifecycle transaction conflict; no mutation commits.',
})
@ApiResponse({
    status: 503,
    description:
        'Authoritative persistence or mandatory audit is unavailable. No unaudited mutation commits.',
})
@UseGuards(IntegrationManagementGuard)
@UseInterceptors(IntegrationManagementInterceptor)
@RequireWorkspaceRole('admin')
export class IntegrationManagementController {
    constructor(private readonly managementService: IntegrationManagementService) {}

    @Post()
    @IntegrationManagementAction('create')
    @ApiOperation({
        summary: 'Create an integration and its first credential atomically (owner/admin only).',
    })
    @ApiHeader({
        name: 'x-csrf-token',
        required: true,
        description: 'Token bound to the current browser session.',
    })
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({ type: IssuedIntegrationCredentialResponseDto })
    @ApiTooManyRequestsResponse({
        description: 'Shared human/source step-up attempt limit exceeded; Retry-After is set.',
    })
    async create(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Body() body: CreateIntegrationCredentialDto,
    ) {
        return this.managementService.create(workspaceId, userId, body)
    }

    @Get()
    @IntegrationManagementAction('list')
    @ApiOperation({
        summary:
            'List safe integration metadata (owner/admin only); never reveals secrets or digests.',
    })
    @ApiOkResponse({ type: IntegrationResponseDto, isArray: true })
    async list(@CurrentWorkspaceId() workspaceId: string) {
        return this.managementService.list(workspaceId)
    }

    @Get(':integrationId')
    @IntegrationManagementAction('get')
    @ApiOperation({ summary: 'Inspect safe integration metadata (owner/admin only).' })
    @ApiOkResponse({ type: IntegrationResponseDto })
    @ApiParam({ name: 'integrationId' })
    async get(
        @CurrentWorkspaceId() workspaceId: string,
        @Param('integrationId') integrationId: string,
    ) {
        return this.managementService.get(workspaceId, integrationId)
    }

    @Post(':integrationId/credentials/:credentialId/revoke')
    @HttpCode(HttpStatus.OK)
    @IntegrationManagementAction('revoke')
    @ApiOperation({
        summary: 'Immediately and irreversibly revoke a credential (owner/admin with step-up).',
    })
    @ApiHeader({ name: 'x-csrf-token', required: true })
    @ApiOkResponse({ type: RevokedIntegrationCredentialResponseDto })
    @ApiTooManyRequestsResponse({
        description: 'Shared human/source step-up attempt limit exceeded; Retry-After is set.',
    })
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
    @HttpCode(HttpStatus.OK)
    @IntegrationManagementAction('rotate')
    @ApiOperation({
        summary:
            'Atomically replace an active, unexpired credential with no overlap (owner/admin with step-up).',
    })
    @ApiHeader({ name: 'x-csrf-token', required: true })
    @ApiConflictResponse({
        description:
            'Credential is expired, revoked, or lost a concurrent lifecycle operation. No replacement commits.',
    })
    @ApiOkResponse({ type: RotatedIntegrationCredentialResponseDto })
    @ApiTooManyRequestsResponse({
        description: 'Shared human/source step-up attempt limit exceeded; Retry-After is set.',
    })
    @ApiParam({ name: 'integrationId' })
    @ApiParam({ name: 'credentialId' })
    async rotate(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
        @Body() body: RotateIntegrationCredentialDto,
    ) {
        return this.managementService.rotate(workspaceId, userId, integrationId, credentialId, body)
    }

    @Delete(':integrationId/credentials/:credentialId')
    @IntegrationManagementAction('delete')
    @ApiOperation({
        summary:
            'Hide an already revoked credential while retaining lifecycle and audit evidence (owner/admin only).',
    })
    @ApiHeader({ name: 'x-csrf-token', required: true })
    @ApiConflictResponse({ description: 'Credential must be revoked before safe deletion.' })
    @ApiOkResponse({ type: DeletedIntegrationCredentialResponseDto })
    @ApiParam({ name: 'integrationId' })
    @ApiParam({ name: 'credentialId' })
    async remove(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('integrationId') integrationId: string,
        @Param('credentialId') credentialId: string,
    ) {
        return this.managementService.remove(workspaceId, integrationId, credentialId, userId)
    }
}
