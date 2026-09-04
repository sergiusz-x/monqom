import { Module } from '@nestjs/common'
import { IntegrationCredentialGuard } from './integration-credential.guard'
import { IntegrationCredentialService } from './integration-credential.service'
import { IntegrationRateLimitService } from './integration-rate-limit.service'

@Module({
    providers: [
        IntegrationCredentialService,
        IntegrationRateLimitService,
        IntegrationCredentialGuard,
    ],
    exports: [IntegrationCredentialService, IntegrationCredentialGuard],
})
export class IntegrationsModule {}
