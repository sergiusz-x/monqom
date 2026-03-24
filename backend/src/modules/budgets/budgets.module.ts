import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { WorkspaceModule } from '../workspace/workspace.module'
import { SessionGuard } from '../../shared/guards/session.guard'
import { BudgetsController } from './budgets.controller'
import { BudgetsRepository } from './budgets.repository'
import { BudgetsService } from './budgets.service'

@Module({
    imports: [WorkspaceModule],
    controllers: [BudgetsController],
    providers: [BudgetsService, BudgetsRepository, AuthRepository, SessionGuard],
})
export class BudgetsModule {}
