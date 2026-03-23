import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthController } from './auth.controller'
import { AuthRepository } from './auth.repository'
import { AuthRateLimitMiddleware } from '../../shared/middleware/authRateLimit'
import { AUTH_BASE_ROUTE, AUTH_ROUTES } from './auth.routes'
import { AuthService } from './auth.service'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceModule } from '../workspace/workspace.module'
import { TwoFactorService } from './twoFactor.service'

const AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const AUTH_LOGIN_RATE_LIMIT_MESSAGE = 'Too many login attempts. Please try again later.'

@Module({
    imports: [
        ThrottlerModule.forRoot({
            errorMessage: AUTH_LOGIN_RATE_LIMIT_MESSAGE,
            throttlers: [
                {
                    limit: 5,
                    ttl: AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
                    blockDuration: AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
                },
            ],
        }),
        WorkspaceModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthRepository, SessionGuard, TwoFactorService],
})
export class AuthModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthRateLimitMiddleware).forRoutes(
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.register}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.forgotPassword}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.resetPassword}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.verifyEmail}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.resendVerification}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.twoFactorSetup}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.twoFactorVerifySetup}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.twoFactorVerify}`,
                method: RequestMethod.POST,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.twoFactorDisable}`,
                method: RequestMethod.POST,
            },
        )
    }
}
