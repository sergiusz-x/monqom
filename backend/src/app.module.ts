import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import envConfig from './config/env'
import { AuthModule } from './modules/auth/auth.module'
import { BudgetsModule } from './modules/budgets/budgets.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { HealthModule } from './modules/health/health.module'
import { PaymentSourcesModule } from './modules/payment-sources/payment-sources.module'
import { TransactionsModule } from './modules/transactions/transactions.module'
import { WorkspaceModule } from './modules/workspace/workspace.module'
import { AuditModule } from './shared/audit/audit.module'
import { DatabaseModule } from './shared/database/database.module'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [envConfig],
        }),
        HealthModule,
        AuthModule,
        WorkspaceModule,
        CategoriesModule,
        BudgetsModule,
        DashboardModule,
        PaymentSourcesModule,
        TransactionsModule,
        AuditModule,
        DatabaseModule,
    ],
})
export class AppModule {}
