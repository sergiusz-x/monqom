import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { BudgetsController } from './budgets.controller'
import { BudgetsRepository } from './budgets.repository'
import { BudgetsService } from './budgets.service'

@Module({
    imports: [AuthCoreModule, WorkspaceModule],
    controllers: [BudgetsController],
    providers: [BudgetsService, BudgetsRepository],
})
export class BudgetsModule {}
