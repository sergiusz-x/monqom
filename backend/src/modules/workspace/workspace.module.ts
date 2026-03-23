import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceController } from './workspace.controller'
import { WorkspaceRepository } from './workspace.repository'
import { WorkspaceService } from './workspace.service'

@Module({
    controllers: [WorkspaceController],
    providers: [WorkspaceService, WorkspaceRepository, AuthRepository, SessionGuard],
    exports: [WorkspaceService, WorkspaceRepository],
})
export class WorkspaceModule {}
