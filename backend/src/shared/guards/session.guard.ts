import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'

const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required'

@Injectable()
export class SessionGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>()

        if (!request.session?.auth?.userId) {
            throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE)
        }

        return true
    }
}
