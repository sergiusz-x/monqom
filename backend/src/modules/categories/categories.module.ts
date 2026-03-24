import { Module } from '@nestjs/common'
import { AuthRepository } from '../auth/auth.repository'
import { WorkspaceModule } from '../workspace/workspace.module'
import { SessionGuard } from '../../shared/guards/session.guard'
import { CategoriesController } from './categories.controller'
import { CategoriesRepository } from './categories.repository'
import { CategoriesService } from './categories.service'

@Module({
    imports: [WorkspaceModule],
    controllers: [CategoriesController],
    providers: [CategoriesService, CategoriesRepository, AuthRepository, SessionGuard],
})
export class CategoriesModule {}
