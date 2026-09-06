import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AuthCoreModule } from '../auth/auth-core.module'
import { TransactionsModule } from '../transactions/transactions.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { CurrencyModule } from '../../shared/currency/currency.module'
import { IntegrationCredentialGuard } from './integration-credential.guard'
import { IntegrationCredentialService } from './integration-credential.service'
import { IntegrationManagementController } from './integration-management.controller'
import { IntegrationManagementService } from './integration-management.service'
import { IntegrationRateLimitService } from './integration-rate-limit.service'
import { ExternalTransactionOwnershipService } from './external-transaction-ownership.service'
import { ExternalTransactionsController } from './external-transactions.controller'
import { ExternalTransactionsService } from './external-transactions.service'

@Module({
    imports: [AuthModule, AuthCoreModule, TransactionsModule, WorkspaceModule, CurrencyModule],
    controllers: [IntegrationManagementController, ExternalTransactionsController],
    providers: [
        IntegrationCredentialService,
        IntegrationRateLimitService,
        IntegrationCredentialGuard,
        IntegrationManagementService,
        ExternalTransactionOwnershipService,
        ExternalTransactionsService,
    ],
    exports: [
        IntegrationCredentialService,
        IntegrationCredentialGuard,
        ExternalTransactionOwnershipService,
    ],
})
export class IntegrationsModule {}
