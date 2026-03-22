import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { AuthRepository } from '../../modules/auth/auth.repository'

const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required'

@Injectable()
export class SessionGuard implements CanActivate {
    constructor(private readonly authRepository: AuthRepository) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()
        const sessionUserId = request.session?.auth?.userId
        const sessionVersion = request.session?.auth?.sessionVersion

        if (!sessionUserId || typeof sessionVersion !== 'number') {
            throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE)
        }

        const user = await this.authRepository.findUserById(sessionUserId)

        if (!user || user.sessionVersion !== sessionVersion) {
            throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE)
        }

        return true
    }
}
