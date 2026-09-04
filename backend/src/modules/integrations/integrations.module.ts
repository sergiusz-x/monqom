import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { IntegrationCredentialGuard } from './integration-credential.guard'
import { IntegrationCredentialService } from './integration-credential.service'
import { IntegrationManagementController } from './integration-management.controller'
import { IntegrationManagementService } from './integration-management.service'
import { IntegrationRateLimitService } from './integration-rate-limit.service'

@Module({
    imports: [AuthModule],
    controllers: [IntegrationManagementController],
    providers: [
        IntegrationCredentialService,
        IntegrationRateLimitService,
        IntegrationCredentialGuard,
        IntegrationManagementService,
    ],
    exports: [IntegrationCredentialService, IntegrationCredentialGuard],
})
export class IntegrationsModule {}
