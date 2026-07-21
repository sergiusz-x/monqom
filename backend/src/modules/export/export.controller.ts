import { Controller, Get, HttpCode, HttpStatus, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { EXPORT_BASE_ROUTE } from './export.routes'
import { ExportService } from './export.service'
import { ExportTransactionsQueryDto } from './export.dto'

@Controller(EXPORT_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class ExportController {
    constructor(private readonly exportService: ExportService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async exportTransactions(
        @Query() query: ExportTransactionsQueryDto,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        const exportFile = await this.exportService.exportTransactions(
            { format: query.format, dateFrom: query.date_from, dateTo: query.date_to },
            req.workspace!.workspaceId,
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
