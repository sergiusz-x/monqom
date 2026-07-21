import { Module } from '@nestjs/common'
import { AuthCoreModule } from '../auth/auth-core.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { CategoriesController } from './categories.controller'
import { CategoriesRepository } from './categories.repository'
import { CategoriesService } from './categories.service'

@Module({
    imports: [AuthCoreModule, WorkspaceModule],
    controllers: [CategoriesController],
    providers: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}
