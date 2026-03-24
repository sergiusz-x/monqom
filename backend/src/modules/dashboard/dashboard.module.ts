import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { WorkspaceModule } from '../workspace/workspace.module'
import { SessionGuard } from '../../shared/guards/session.guard'
import { DashboardController } from './dashboard.controller'
import { DashboardRepository } from './dashboard.repository'
import { DashboardService } from './dashboard.service'

@Module({
    imports: [WorkspaceModule],
    controllers: [DashboardController],
    providers: [DashboardService, DashboardRepository, AuthRepository, SessionGuard],
})
export class DashboardModule {}
