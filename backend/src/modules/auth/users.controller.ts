import { Body, Controller, HttpCode, HttpStatus, Put, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { AuthenticatedUserResponse, AuthService } from './auth.service'

@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
    constructor(private readonly authService: AuthService) {}

    @Put('me')
    @HttpCode(HttpStatus.OK)
    async updateMe(
        @Req() req: Request,
        @Body() body: Record<string, unknown>,
    ): Promise<AuthenticatedUserResponse> {
        return this.authService.updateAuthenticatedUser(req.session.auth!.userId, body)
    }
}
