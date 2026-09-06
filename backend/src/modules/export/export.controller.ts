import { Controller, Get, HttpCode, HttpStatus, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { EXPORT_BASE_ROUTE } from './export.routes'
import { ExportService } from './export.service'
import { ExportTransactionsQueryDto } from './export.dto'
import { ApiOkResponse, ApiParam } from '@nestjs/swagger'
import { CurrentWorkspaceId } from '../../shared/http/request-context.decorator'

@Controller(EXPORT_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiParam({ name: 'workspaceId', type: String })
export class ExportController {
    constructor(private readonly exportService: ExportService) {}

    @Get()
    @ApiOkResponse({
        content: {
            'text/csv': { schema: { type: 'string', format: 'binary' } },
            'application/json': { schema: { type: 'string', format: 'binary' } },
        },
    })
    @HttpCode(HttpStatus.OK)
    async exportTransactions(
        @Query() query: ExportTransactionsQueryDto,
        @CurrentWorkspaceId() workspaceId: string,
        @Res() res: Response,
    ): Promise<void> {
        const exportFile = await this.exportService.exportTransactions(
            { format: query.format, dateFrom: query.date_from, dateTo: query.date_to },
            workspaceId,
        )

        res.status(HttpStatus.OK)
        res.setHeader('Content-Type', exportFile.contentType)
        res.setHeader('Content-Disposition', exportFile.contentDisposition)
        res.flushHeaders()

        try {
            for await (const chunk of exportFile.chunks) {
                res.write(chunk)
            }

            res.end()
        } catch (error) {
            res.destroy(error as Error)
        }
    }
}
