import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { UsersController } from './users.controller'
import { AuthRateLimitMiddleware } from '../../shared/middleware/authRateLimit'
import { AUTH_BASE_ROUTE, AUTH_ROUTES } from './auth.routes'
import { AuthService } from './auth.service'
import { AuthCoreModule } from './auth-core.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { TwoFactorService } from './twoFactor.service'

@Module({
    imports: [ConfigModule, WorkspaceModule, AuthCoreModule],
    controllers: [AuthController, UsersController],
    providers: [AuthService, TwoFactorService],
})
export class AuthModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(AuthRateLimitMiddleware).forRoutes(
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.csrfToken}`,
                method: RequestMethod.GET,
            },
            {
                path: `${AUTH_BASE_ROUTE}/${AUTH_ROUTES.login}`,
                method: RequestMethod.POST,
            },
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
