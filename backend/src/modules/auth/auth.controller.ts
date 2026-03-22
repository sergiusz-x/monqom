import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { AUTH_BASE_ROUTE, AUTH_ROUTES } from './auth.routes'
import {
    AuthActionResponse,
    AuthService,
    AuthenticatedUserResponse,
    RegisteredUserResponse,
} from './auth.service'
import {
    createSessionCookieClearingOptions,
    SESSION_COOKIE_NAME,
} from '../../shared/session/session.config'
import { SessionGuard } from '../../shared/guards/session.guard'

const AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
const LOGOUT_SUCCESS_MESSAGE = 'Logged out successfully'

@Controller(AUTH_BASE_ROUTE)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @Post(AUTH_ROUTES.register)
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() body: Record<string, unknown>): Promise<RegisteredUserResponse> {
        return this.authService.register(body)
    }

    @Post(AUTH_ROUTES.login)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
            ttl: AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
            blockDuration: AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
        },
    })
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ): Promise<AuthenticatedUserResponse> {
        const { sessionVersion, ...user } = await this.authService.login(body)

        await regenerateSession(req)
        req.session.auth = {
            userId: user.id,
            sessionVersion,
        }
        await this.authService.recordSuccessfulLogin({
            userId: user.id,
            ipAddress: getRequestIp(req),
        })
        await saveSession(req)

        return user
    }

    @Post(AUTH_ROUTES.logout)
    @UseGuards(SessionGuard)
    @HttpCode(HttpStatus.OK)
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthActionResponse> {
        const userId = req.session.auth?.userId

        await destroySession(req)
        res.clearCookie(SESSION_COOKIE_NAME, createSessionCookieClearingOptions(this.getNodeEnv()))

        if (userId) {
            await this.authService.recordSuccessfulLogout({
                userId,
                ipAddress: getRequestIp(req),
            })
        }

        return {
            message: LOGOUT_SUCCESS_MESSAGE,
        }
    }

    @Get(AUTH_ROUTES.me)
    @UseGuards(SessionGuard)
    @HttpCode(HttpStatus.OK)
    async me(@Req() req: Request): Promise<AuthenticatedUserResponse> {
        return this.authService.getAuthenticatedUser(req.session.auth!.userId)
    }

    @Post(AUTH_ROUTES.verifyEmail)
    @HttpCode(HttpStatus.OK)
    async verifyEmail(@Body() body: Record<string, unknown>): Promise<AuthActionResponse> {
        return this.authService.verifyEmail(body)
    }

    @Post(AUTH_ROUTES.resendVerification)
    @HttpCode(HttpStatus.OK)
    async resendVerification(@Body() body: Record<string, unknown>): Promise<AuthActionResponse> {
        return this.authService.resendVerification(body)
    }

    @Post(AUTH_ROUTES.forgotPassword)
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() body: Record<string, unknown>): Promise<AuthActionResponse> {
        return this.authService.forgotPassword(body)
    }

    @Post(AUTH_ROUTES.resetPassword)
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() body: Record<string, unknown>): Promise<AuthActionResponse> {
        return this.authService.resetPassword(body)
    }

    private getNodeEnv(): string {
        return this.configService.get<string>('env.nodeEnv', 'development')
    }
}

function regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}

function saveSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}

function destroySession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
        req.session.destroy((error) => {
            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}

function getRequestIp(req: Request): string | undefined {
    return typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : undefined
}
