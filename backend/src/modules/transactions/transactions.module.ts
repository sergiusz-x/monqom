import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { WorkspaceModule } from '../workspace/workspace.module'
import { SessionGuard } from '../../shared/guards/session.guard'
import { TransactionTagsController, TransactionsController } from './transactions.controller'
import { TransactionsRepository } from './transactions.repository'
import { TransactionsService } from './transactions.service'

@Module({
    imports: [WorkspaceModule],
    controllers: [TransactionsController, TransactionTagsController],
    providers: [TransactionsService, TransactionsRepository, AuthRepository, SessionGuard],
})
export class TransactionsModule {}
