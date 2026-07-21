import {
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Put,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import {
    createSessionCookieClearingOptions,
    SESSION_COOKIE_NAME,
} from '../../shared/session/session.config'
import { AuthActionResponse, AuthenticatedUserResponse, AuthService } from './auth.service'
import { UpdateUserProfileDto } from './auth.dto'

@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @Put('me')
    @HttpCode(HttpStatus.OK)
    async updateMe(
        @Req() req: Request,
        @Body() body: UpdateUserProfileDto,
    ): Promise<AuthenticatedUserResponse> {
        return this.authService.updateAuthenticatedUser(req.session.auth!.userId, {
            name: body.name,
            locale: body.locale as 'en' | 'pl' | undefined,
        })
    }

    @Delete('me')
    @HttpCode(HttpStatus.OK)
    async deleteMe(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthActionResponse> {
        const userId = req.session.auth!.userId
        const result = await this.authService.deleteAuthenticatedUser(userId)
        await destroySession(req)
        res.clearCookie(
            SESSION_COOKIE_NAME,
            createSessionCookieClearingOptions(
                this.configService.get<string>('env.nodeEnv', 'development'),
            ),
        )
        return result
    }
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
