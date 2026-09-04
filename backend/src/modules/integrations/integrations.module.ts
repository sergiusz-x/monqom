import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { TransactionsModule } from '../transactions/transactions.module'
import { IntegrationCredentialGuard } from './integration-credential.guard'
import { IntegrationCredentialService } from './integration-credential.service'
import { IntegrationManagementController } from './integration-management.controller'
import { IntegrationManagementService } from './integration-management.service'
import { IntegrationRateLimitService } from './integration-rate-limit.service'
import { ExternalTransactionOwnershipService } from './external-transaction-ownership.service'

@Module({
    imports: [AuthModule, TransactionsModule],
    controllers: [IntegrationManagementController],
    providers: [
        IntegrationCredentialService,
        IntegrationRateLimitService,
        IntegrationCredentialGuard,
        IntegrationManagementService,
        ExternalTransactionOwnershipService,
    ],
    exports: [
        IntegrationCredentialService,
        IntegrationCredentialGuard,
        ExternalTransactionOwnershipService,
    ],
})
export class IntegrationsModule {}
