import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { WorkspaceModule } from '../workspace/workspace.module'
import { SessionGuard } from '../../shared/guards/session.guard'
import { PaymentSourcesController } from './payment-sources.controller'
import { PaymentSourcesRepository } from './payment-sources.repository'
import { PaymentSourcesService } from './payment-sources.service'

@Module({
    imports: [WorkspaceModule],
    controllers: [PaymentSourcesController],
    providers: [PaymentSourcesService, PaymentSourcesRepository, AuthRepository, SessionGuard],
})
export class PaymentSourcesModule {}
