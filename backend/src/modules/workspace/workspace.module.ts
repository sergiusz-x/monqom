import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { WorkspaceController, WorkspaceScopedController } from './workspace.controller'
import { WorkspaceRepository } from './workspace.repository'
import { WorkspaceService } from './workspace.service'
import { WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'

@Module({
    imports: [AuthCoreModule],
    controllers: [WorkspaceController, WorkspaceScopedController],
    providers: [WorkspaceService, WorkspaceRepository, WorkspaceGuard, WorkspaceRoleGuard],
    exports: [WorkspaceService, WorkspaceRepository, WorkspaceGuard, WorkspaceRoleGuard],
})
export class WorkspaceModule {}
