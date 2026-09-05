import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common'
import { ApiParam } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { PAYMENT_SOURCES_BASE_ROUTE } from './payment-sources.routes'
import { PaymentSourceResponse, PaymentSourcesService } from './payment-sources.service'
import { ListPaymentSourcesQueryDto, PaymentSourceBodyDto } from './payment-sources.dto'
import { ApiPaymentSourceResponse } from '../../shared/openapi/response-schemas'
import { CurrentUserId, CurrentWorkspaceId } from '../../shared/http/request-context.decorator'

@Controller(PAYMENT_SOURCES_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiParam({ name: 'workspaceId', type: String })
export class PaymentSourcesController {
    constructor(private readonly paymentSourcesService: PaymentSourcesService) {}

    @Get()
    @ApiPaymentSourceResponse(true)
    @HttpCode(HttpStatus.OK)
    async listPaymentSources(
        @Query() query: ListPaymentSourcesQueryDto,
        @CurrentWorkspaceId() workspaceId: string,
    ): Promise<PaymentSourceResponse[]> {
        return this.paymentSourcesService.listPaymentSources(
            { includeArchived: query.include_archived },
            workspaceId,
        )
    }

    @Post()
    @ApiPaymentSourceResponse(false, HttpStatus.CREATED)
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.CREATED)
    async createPaymentSource(
        @Body() body: PaymentSourceBodyDto,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.createPaymentSource(
            { name: body.name, type: body.type },
            workspaceId,
            userId,
        )
    }

    @Put(':id')
    @ApiPaymentSourceResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.OK)
    async updatePaymentSource(
        @Param('id') paymentSourceId: string,
        @Body() body: PaymentSourceBodyDto,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.updatePaymentSource(
            { name: body.name, type: body.type },
            paymentSourceId,
            workspaceId,
            userId,
        )
    }

    @Post(':id/archive')
    @ApiPaymentSourceResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.OK)
    async archivePaymentSource(
        @Param('id') paymentSourceId: string,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.archivePaymentSource(
            paymentSourceId,
            workspaceId,
            userId,
        )
    }
}
