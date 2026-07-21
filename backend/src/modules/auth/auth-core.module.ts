import { Module } from '@nestjs/common'
import { SessionGuard } from '../../shared/guards/session.guard'
import { AuthRepository } from './auth.repository'

@Module({
    providers: [AuthRepository, SessionGuard],
    exports: [AuthRepository, SessionGuard],
})
export class AuthCoreModule {}
