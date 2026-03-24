import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import { AuditAction, AuditEntityType, AuditMetadata } from './audit.types'

export type AuditPersistenceClient = Prisma.TransactionClient | PrismaService

export interface RecordAuditEventInput {
    action: AuditAction
    workspaceId?: string | null
    userId?: string | null
    entityType?: AuditEntityType | null
    entityId?: string | null
    metadata?: AuditMetadata
}

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) {}

    async record(
        input: RecordAuditEventInput,
        prisma: AuditPersistenceClient = this.prisma,
    ): Promise<void> {
        const data: Prisma.AuditEventUncheckedCreateInput = {
            action: input.action,
        }

        if (input.workspaceId !== undefined) {
            data.workspaceId = input.workspaceId
        }

        if (input.userId !== undefined) {
            data.userId = input.userId
        }

        if (input.entityType !== undefined) {
            data.entityType = input.entityType
        }

        if (input.entityId !== undefined) {
            data.entityId = input.entityId
        }

        if (input.metadata !== undefined) {
            data.metadata = input.metadata
        }

        await prisma.auditEvent.create({
            data,
        })
    }
}
