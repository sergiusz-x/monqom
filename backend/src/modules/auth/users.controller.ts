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
import { ApiMessageResponse, ApiUserResponse } from '../../shared/openapi/response-schemas'
import { CurrentUserId } from '../../shared/http/request-context.decorator'
import { destroySession } from '../../shared/session/session-lifecycle'

@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @Put('me')
    @ApiUserResponse()
    @HttpCode(HttpStatus.OK)
    async updateMe(
        @Body() body: UpdateUserProfileDto,
        @CurrentUserId() userId: string,
    ): Promise<AuthenticatedUserResponse> {
        return this.authService.updateAuthenticatedUser(userId, {
            name: body.name,
            locale: body.locale as 'en' | 'pl' | undefined,
            hideSalaryAmounts: body.hide_salary_amounts,
        })
    }

    @Delete('me')
    @ApiMessageResponse()
    @HttpCode(HttpStatus.OK)
    async deleteMe(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @CurrentUserId() userId: string,
    ): Promise<AuthActionResponse> {
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

