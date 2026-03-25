import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { TransactionsModule } from '../transactions/transactions.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { SessionGuard } from '../../shared/guards/session.guard'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
    imports: [WorkspaceModule, TransactionsModule],
    controllers: [ExportController],
    providers: [ExportService, AuthRepository, SessionGuard],
})
export class ExportModule {}
