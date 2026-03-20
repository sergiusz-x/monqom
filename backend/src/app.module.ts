import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import envConfig from './config/env'
import { HealthModule } from './modules/health/health.module'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [envConfig],
        }),
        HealthModule,
    ],
})
export class AppModule {}
