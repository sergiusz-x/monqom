import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { TransactionTagsController, TransactionsController } from './transactions.controller'
import { TransactionsRepository } from './transactions.repository'
import { TransactionsService } from './transactions.service'

@Module({
    imports: [AuthCoreModule, WorkspaceModule],
    controllers: [TransactionsController, TransactionTagsController],
    providers: [TransactionsService, TransactionsRepository],
    exports: [TransactionsRepository],
})
export class TransactionsModule {}
