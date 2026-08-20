import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SessionGuard } from '../../shared/guards/session.guard'
import { AuthRepository } from './auth.repository'

@Module({
    imports: [ConfigModule],
    providers: [AuthRepository, SessionGuard],
    exports: [AuthRepository, SessionGuard],
})
export class AuthCoreModule {}
