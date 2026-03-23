import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { WorkspaceController, WorkspaceScopedController } from './workspace.controller'
import { WorkspaceRepository } from './workspace.repository'
import { WorkspaceService } from './workspace.service'

@Module({
    controllers: [WorkspaceController, WorkspaceScopedController],
    providers: [
        WorkspaceService,
        WorkspaceRepository,
        AuthRepository,
        SessionGuard,
        WorkspaceGuard,
    ],
    exports: [WorkspaceService, WorkspaceRepository, WorkspaceGuard],
})
export class WorkspaceModule {}
