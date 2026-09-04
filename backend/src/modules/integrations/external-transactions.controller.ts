import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    HttpException,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiParam } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import {
    IntegrationCredentialGuard,
    RequireIntegrationScopes,
} from './integration-credential.guard'
import { ExternalTransactionBodyDto } from './external-transactions.dto'
import { ExternalTransactionsService } from './external-transactions.service'

@Controller('workspaces/:workspaceId')
@UseGuards(IntegrationCredentialGuard)
@ApiBearerAuth()
@ApiParam({ name: 'workspaceId', type: String })
export class ExternalTransactionsController {
    constructor(private readonly service: ExternalTransactionsService) {}

    @Post('external-transactions')
    @RequireIntegrationScopes('transactions:create')
    @ApiHeader({
        name: 'Idempotency-Key',
        required: true,
        schema: { type: 'string', minLength: 16, maxLength: 128 },
    })
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Req() req: Request,
        @Headers('idempotency-key') key: string,
        @Body() body: ExternalTransactionBodyDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.service.create(req.machine!, key, body)
        response.setHeader('ETag', `"tx-v${result.version}"`)
        return result
    }

    @Get('external-transactions/:externalId')
    @RequireIntegrationScopes('transactions:read-own')
    async get(
        @Req() req: Request,
        @Param('externalId') externalId: string,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.service.get(req.machine!, externalId)
        response.setHeader('ETag', `"tx-v${result.version}"`)
        return result
    }

    @Put('external-transactions/:externalId')
    @RequireIntegrationScopes('transactions:update-own')
    @ApiHeader({
        name: 'Idempotency-Key',
        required: true,
        schema: { type: 'string', minLength: 16, maxLength: 128 },
    })
    @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"tx-v1"' } })
    async update(
        @Req() req: Request,
        @Param('externalId') externalId: string,
        @Headers('idempotency-key') key: string,
        @Headers('if-match') ifMatch: string | undefined,
        @Body() body: ExternalTransactionBodyDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.service.update(
            req.machine!,
            key,
            externalId,
            parseEtag(ifMatch),
            body,
        )
        response.setHeader('ETag', `"tx-v${result.version}"`)
        return result
    }

    @Delete('external-transactions/:externalId')
    @RequireIntegrationScopes('transactions:delete-own')
    @ApiHeader({
        name: 'Idempotency-Key',
        required: true,
        schema: { type: 'string', minLength: 16, maxLength: 128 },
    })
    @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"tx-v1"' } })
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @Req() req: Request,
        @Param('externalId') externalId: string,
        @Headers('idempotency-key') key: string,
        @Headers('if-match') ifMatch: string | undefined,
    ) {
        await this.service.remove(req.machine!, key, externalId, parseEtag(ifMatch))
    }

    @Get('external-categories')
    @RequireIntegrationScopes('categories:read')
    async categories(@Req() req: Request) {
        return this.service.listCategories(req.machine!)
    }

    @Get('external-payment-sources')
    @RequireIntegrationScopes('payment-sources:read')
    async paymentSources(@Req() req: Request) {
        return this.service.listPaymentSources(req.machine!)
    }
}

function parseEtag(value: string | undefined): number {
    const match = /^"tx-v([1-9]\d*)"$/.exec(value ?? '')
    if (!match) throw new HttpException('If-Match is required', HttpStatus.PRECONDITION_REQUIRED)
    return Number(match[1])
}
