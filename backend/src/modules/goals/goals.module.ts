import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { GoalsController } from './goals.controller'
import { GoalsService } from './goals.service'

@Module({
    imports: [AuthCoreModule, WorkspaceModule],
    controllers: [GoalsController],
    providers: [GoalsService],
})
export class GoalsModule {}
