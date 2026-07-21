import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { PaymentSourcesController } from './payment-sources.controller'
import { PaymentSourcesRepository } from './payment-sources.repository'
import { PaymentSourcesService } from './payment-sources.service'

@Module({
    imports: [AuthCoreModule, WorkspaceModule],
    controllers: [PaymentSourcesController],
    providers: [PaymentSourcesService, PaymentSourcesRepository],
})
export class PaymentSourcesModule {}
