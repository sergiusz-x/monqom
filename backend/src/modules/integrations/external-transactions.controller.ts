import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Req,
    Res,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiParam } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import {
    IntegrationCredentialGuard,
    RequireIntegrationScopes,
} from './integration-credential.guard'
import { ExternalTransactionBodyDto } from './external-transactions.dto'
import { ExternalTransactionsService } from './external-transactions.service'
import { parseExternalTransactionEtag } from './external-transaction-contract'
import { ExternalTransactionsInterceptor } from './external-transactions.interceptor'
import { ApiExternalOperation } from './external-transactions.openapi'

@Controller('workspaces/:workspaceId')
@UseGuards(IntegrationCredentialGuard)
@UseInterceptors(ExternalTransactionsInterceptor)
@ApiBearerAuth('integrationCredential')
@ApiParam({ name: 'workspaceId', type: String })
export class ExternalTransactionsController {
    constructor(private readonly service: ExternalTransactionsService) {}

    @Post('external-transactions')
    @ApiExternalOperation('create')
    @RequireIntegrationScopes('transactions:create')
    @ApiHeader({
        name: 'Idempotency-Key',
        required: false,
        schema: { type: 'string', minLength: 16, maxLength: 128 },
    })
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Req() req: Request,
        @Body() body: ExternalTransactionBodyDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.service.create(req.machine!, req.get('idempotency-key'), body)
        if ('version' in result) response.setHeader('ETag', `"tx-v${result.version}"`)
        else response.status(HttpStatus.OK)
        return result
    }

    @Get('external-transactions/:externalId')
    @ApiExternalOperation('get')
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
    @ApiExternalOperation('update')
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
        @Body() body: ExternalTransactionBodyDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.service.update(
            req.machine!,
            req.get('idempotency-key')!,
            externalId,
            parseExternalTransactionEtag(req.get('if-match')),
            body,
        )
        response.setHeader('ETag', `"tx-v${result.version}"`)
        return result
    }

    @Delete('external-transactions/:externalId')
    @ApiExternalOperation('delete')
    @RequireIntegrationScopes('transactions:delete-own')
    @ApiHeader({
        name: 'Idempotency-Key',
        required: true,
        schema: { type: 'string', minLength: 16, maxLength: 128 },
    })
    @ApiHeader({ name: 'If-Match', required: true, schema: { type: 'string', example: '"tx-v1"' } })
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Req() req: Request, @Param('externalId') externalId: string) {
        await this.service.remove(
            req.machine!,
            req.get('idempotency-key')!,
            externalId,
            parseExternalTransactionEtag(req.get('if-match')),
        )
    }

    @Get('external-categories')
    @ApiExternalOperation('categories')
    @RequireIntegrationScopes('categories:read')
    async categories(@Req() req: Request) {
        return this.service.listCategories(req.machine!)
    }

    @Get('external-payment-sources')
    @ApiExternalOperation('payment-sources')
    @RequireIntegrationScopes('payment-sources:read')
    async paymentSources(@Req() req: Request) {
        return this.service.listPaymentSources(req.machine!)
    }
}
