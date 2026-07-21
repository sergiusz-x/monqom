import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { TransactionsModule } from '../transactions/transactions.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
    imports: [AuthCoreModule, WorkspaceModule, TransactionsModule],
    controllers: [ExportController],
    providers: [ExportService],
})
export class ExportModule {}
