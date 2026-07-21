import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { DashboardController } from './dashboard.controller'
import { DashboardRepository } from './dashboard.repository'
import { DashboardService } from './dashboard.service'
import { TransactionsModule } from '../transactions/transactions.module'

@Module({
    imports: [AuthCoreModule, WorkspaceModule, TransactionsModule],
    controllers: [DashboardController],
    providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
