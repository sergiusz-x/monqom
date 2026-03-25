import { Controller, Get, HttpCode, HttpStatus, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { EXPORT_BASE_ROUTE } from './export.routes'
import { ExportService } from './export.service'

@Controller(EXPORT_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class ExportController {
    constructor(private readonly exportService: ExportService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async exportTransactions(@Req() req: Request, @Res() res: Response): Promise<void> {
        const exportFile = await this.exportService.exportTransactions(
            req.query as Record<string, unknown>,
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
