import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { AUTH_BASE_ROUTE, AUTH_ROUTES } from './auth.routes'
import {
    ChangePasswordDto,
    CurrentPasswordDto,
    EmailDto,
    LoginDto,
    RegisterDto,
    ResetPasswordDto,
    TokenDto,
} from './auth.dto'
import {
    AuthActionResponse,
    AuthService,
    AuthenticatedUserResponse,
    LoginServiceResult,
    RegisteredUserResponse,
} from './auth.service'
import {
    createSessionCookieClearingOptions,
    SESSION_COOKIE_NAME,
} from '../../shared/session/session.config'
import { SessionGuard } from '../../shared/guards/session.guard'
import { getOrCreateCsrfToken } from '../../shared/security/csrf'
import { verifyTurnstileToken } from '../../shared/security/turnstile'
import {
    TwoFactorLoginVerificationResponse,
    TwoFactorService,
    TwoFactorSetupResponse,
    TwoFactorVerifySetupResponse,
} from './twoFactor.service'

const AUTH_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
const CSRF_TOKEN_RATE_LIMIT_MAX_REQUESTS = 60
const LOGOUT_SUCCESS_MESSAGE = 'Logged out successfully'
const TWO_FACTOR_REQUIRED_MESSAGE = 'Two-factor authentication required'
const TWO_FACTOR_CHALLENGE_REQUIRED_MESSAGE = 'Two-factor authentication challenge required'

type LoginResponse =
    | AuthenticatedUserResponse
    | {
          requiresTwoFactor: true
          message: string
      }
type TwoFactorLoginResponse = AuthenticatedUserResponse & {
    recoveryCodeUsed: boolean
}

@Controller(AUTH_BASE_ROUTE)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly twoFactorService: TwoFactorService,
        private readonly configService: ConfigService,
    ) {}

    @Get(AUTH_ROUTES.csrfToken)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: CSRF_TOKEN_RATE_LIMIT_MAX_REQUESTS,
            ttl: AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
        },
    })
    getCsrfToken(@Req() req: Request): { csrfToken: string } {
        return { csrfToken: getOrCreateCsrfToken(req) }
    }

    @Post(AUTH_ROUTES.register)
    @HttpCode(HttpStatus.CREATED)
    async register(
        @Body() body: RegisterDto,
        @Req() req: Request,
    ): Promise<RegisteredUserResponse> {
        await verifyTurnstileToken({ token: body.turnstile_token, remoteIp: getRequestIp(req) })
        return this.authService.register({
            email: body.email,
            name: body.name,
            password: body.password,
            locale: body.locale as 'en' | 'pl' | undefined,
            baseCurrency: body.base_currency,
        })
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
    async login(@Body() body: LoginDto, @Req() req: Request): Promise<LoginResponse> {
        const loginResult = await this.authService.login({
            email: body.email,
            password: body.password,
        })

        await regenerateSession(req)

        if (loginResult.type === 'two_factor_required') {
            delete req.session.auth
            req.session.twoFactorChallenge = {
                userId: loginResult.userId,
                sessionVersion: loginResult.sessionVersion,
            }
            await saveSession(req)

            return {
                requiresTwoFactor: true,
                message: TWO_FACTOR_REQUIRED_MESSAGE,
            }
        }

        const user = finalizeAuthenticatedSession(req, loginResult)
        await this.authService.recordSuccessfulLogin({
            userId: user.id,
            ipAddress: getRequestIp(req),
        })
        await saveSession(req)

        return user
    }

    @Post(AUTH_ROUTES.twoFactorSetup)
    @UseGuards(SessionGuard)
    @HttpCode(HttpStatus.OK)
    async setupTwoFactor(@Req() req: Request): Promise<TwoFactorSetupResponse> {
        return this.twoFactorService.setup(req.session.auth!.userId)
    }

    @Post(AUTH_ROUTES.twoFactorVerifySetup)
    @UseGuards(SessionGuard)
    @HttpCode(HttpStatus.OK)
    async verifyTwoFactorSetup(
        @Req() req: Request,
        @Body() body: TokenDto,
    ): Promise<TwoFactorVerifySetupResponse> {
        return this.twoFactorService.verifySetup(req.session.auth!.userId, { token: body.token })
    }

    @Post(AUTH_ROUTES.twoFactorVerify)
    @HttpCode(HttpStatus.OK)
    async verifyTwoFactor(
        @Req() req: Request,
        @Body() body: TokenDto,
    ): Promise<TwoFactorLoginResponse> {
        const challenge = req.session.twoFactorChallenge

        if (!challenge) {
            throw new UnauthorizedException(TWO_FACTOR_CHALLENGE_REQUIRED_MESSAGE)
        }

        const loginResult = finalizeTwoFactorSession(
            req,
            await this.twoFactorService.verifyLogin(challenge, { token: body.token }),
        )

        await this.authService.recordSuccessfulLogin({
            userId: loginResult.id,
            ipAddress: getRequestIp(req),
        })
        await saveSession(req)

        return toTwoFactorLoginResponse(loginResult)
    }

    @Post(AUTH_ROUTES.twoFactorDisable)
    @UseGuards(SessionGuard)
    @HttpCode(HttpStatus.OK)
    async disableTwoFactor(
        @Req() req: Request,
        @Body() body: CurrentPasswordDto,
    ): Promise<AuthActionResponse> {
        return this.twoFactorService.disable(req.session.auth!.userId, {
            currentPassword: body.currentPassword,
        })
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
    async verifyEmail(@Body() body: TokenDto): Promise<AuthActionResponse> {
        return this.authService.verifyEmail({ token: body.token })
    }

    @Post(AUTH_ROUTES.resendVerification)
    @HttpCode(HttpStatus.OK)
    async resendVerification(@Body() body: EmailDto): Promise<AuthActionResponse> {
        return this.authService.resendVerification({ email: body.email })
    }

    @Post(AUTH_ROUTES.forgotPassword)
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() body: EmailDto): Promise<AuthActionResponse> {
        return this.authService.forgotPassword({ email: body.email })
    }

    @Post(AUTH_ROUTES.resetPassword)
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() body: ResetPasswordDto): Promise<AuthActionResponse> {
        return this.authService.resetPassword({ token: body.token, newPassword: body.newPassword })
    }

    @Post(AUTH_ROUTES.changePassword)
    @UseGuards(SessionGuard)
    @HttpCode(HttpStatus.OK)
    async changePassword(
        @Req() req: Request,
        @Body() body: ChangePasswordDto,
    ): Promise<AuthActionResponse> {
        return this.authService.changePassword(req.session.auth!.userId, {
            currentPassword: body.currentPassword,
            newPassword: body.newPassword,
        })
    }

    private getNodeEnv(): string {
        return this.configService.get<string>('env.nodeEnv', 'development')
    }
}

function regenerateSession(req: Request): Promise<void> {
    const csrfToken = req.session.csrfToken

    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) {
                reject(error)
                return
            }

            req.session.csrfToken = csrfToken
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

function finalizeAuthenticatedSession(
    req: Request,
    loginResult: Extract<LoginServiceResult, { type: 'authenticated' }>,
): AuthenticatedUserResponse {
    delete req.session.twoFactorChallenge
    req.session.auth = {
        userId: loginResult.user.id,
        sessionVersion: loginResult.user.sessionVersion,
    }

    return {
        id: loginResult.user.id,
        email: loginResult.user.email,
        name: loginResult.user.name,
        locale: loginResult.user.locale,
        emailVerified: loginResult.user.emailVerified,
        totpEnabled: loginResult.user.totpEnabled,
        createdAt: loginResult.user.createdAt,
        updatedAt: loginResult.user.updatedAt,
    }
}

function finalizeTwoFactorSession(
    req: Request,
    loginResult: TwoFactorLoginVerificationResponse,
): TwoFactorLoginVerificationResponse {
    delete req.session.twoFactorChallenge
    req.session.auth = {
        userId: loginResult.id,
        sessionVersion: loginResult.sessionVersion,
    }

    return loginResult
}

function toTwoFactorLoginResponse(
    loginResult: TwoFactorLoginVerificationResponse,
): TwoFactorLoginResponse {
    return {
        id: loginResult.id,
        email: loginResult.email,
        name: loginResult.name,
        locale: loginResult.locale,
        emailVerified: loginResult.emailVerified,
        totpEnabled: loginResult.totpEnabled,
        recoveryCodeUsed: loginResult.recoveryCodeUsed,
        createdAt: loginResult.createdAt,
        updatedAt: loginResult.updatedAt,
    }
}
