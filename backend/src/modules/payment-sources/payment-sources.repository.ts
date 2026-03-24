import { Injectable } from '@nestjs/common'
import { PaymentSource, Prisma } from '@prisma/client'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { PrismaService } from '../../shared/database/prisma.service'

export interface CreatePaymentSourceRecordInput {
    workspaceId: string
    userId: string
    name: string
    type: string
}

export interface UpdatePaymentSourceRecordInput {
    workspaceId: string
    paymentSourceId: string
    userId: string
    name: string
    type: string
    previousPaymentSource: PaymentSource
}

export interface ArchivePaymentSourceRecordInput {
    workspaceId: string
    paymentSourceId: string
    userId: string
    archivedAt: Date
    paymentSource: PaymentSource
}

export type PaymentSourcesPersistenceClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class PaymentSourcesRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    async listPaymentSourcesByWorkspace(
        workspaceId: string,
        includeArchived = false,
        prisma: PaymentSourcesPersistenceClient = this.prisma,
    ): Promise<PaymentSource[]> {
        return prisma.paymentSource.findMany({
            where: {
                workspaceId,
                ...(includeArchived ? {} : { deletedAt: null }),
            },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
        })
    }

    async findPaymentSourceById(
        workspaceId: string,
        paymentSourceId: string,
        includeArchived = false,
        prisma: PaymentSourcesPersistenceClient = this.prisma,
    ): Promise<PaymentSource | null> {
        return prisma.paymentSource.findFirst({
            where: {
                workspaceId,
                id: paymentSourceId,
                ...(includeArchived ? {} : { deletedAt: null }),
            },
        })
    }

    async createPaymentSource(
        input: CreatePaymentSourceRecordInput,
        prisma: PaymentSourcesPersistenceClient = this.prisma,
    ): Promise<PaymentSource> {
        const paymentSource = await prisma.paymentSource.create({
            data: {
                workspaceId: input.workspaceId,
                name: input.name,
                type: input.type,
            },
        })

        await this.auditService.record(
            {
                action: AUDIT_ACTIONS.PAYMENT_SOURCE_CREATED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.PAYMENT_SOURCE,
                entityId: paymentSource.id,
                metadata: mapPaymentSourceAuditMetadata(paymentSource),
            },
            prisma,
        )

        return paymentSource
    }

    async updatePaymentSource(
        input: UpdatePaymentSourceRecordInput,
        prisma: PaymentSourcesPersistenceClient = this.prisma,
    ): Promise<PaymentSource | null> {
        const updatedPaymentSource = await prisma.paymentSource.updateMany({
            where: {
                workspaceId: input.workspaceId,
                id: input.paymentSourceId,
                deletedAt: null,
            },
            data: {
                name: input.name,
                type: input.type,
            },
        })

        if (updatedPaymentSource.count === 0) {
            return null
        }

        const paymentSource = await this.findPaymentSourceById(
            input.workspaceId,
            input.paymentSourceId,
            false,
            prisma,
        )

        if (!paymentSource) {
            return null
        }

        await this.auditService.record(
            {
                action: AUDIT_ACTIONS.PAYMENT_SOURCE_UPDATED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.PAYMENT_SOURCE,
                entityId: paymentSource.id,
                metadata: {
                    previous: mapPaymentSourceAuditMetadata(input.previousPaymentSource),
                    current: mapPaymentSourceAuditMetadata(paymentSource),
                },
            },
            prisma,
        )

        return paymentSource
    }

    async archivePaymentSource(
        input: ArchivePaymentSourceRecordInput,
        prisma: PaymentSourcesPersistenceClient = this.prisma,
    ): Promise<boolean> {
        const archivedPaymentSource = await prisma.paymentSource.updateMany({
            where: {
                workspaceId: input.workspaceId,
                id: input.paymentSourceId,
                deletedAt: null,
            },
            data: {
                deletedAt: input.archivedAt,
            },
        })

        if (archivedPaymentSource.count === 0) {
            return false
        }

        await this.auditService.record(
            {
                action: AUDIT_ACTIONS.PAYMENT_SOURCE_ARCHIVED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.PAYMENT_SOURCE,
                entityId: input.paymentSourceId,
                metadata: {
                    ...mapPaymentSourceAuditMetadata(input.paymentSource),
                    archived_at: input.archivedAt.toISOString(),
                },
            },
            prisma,
        )

        return true
    }
}

function mapPaymentSourceAuditMetadata(paymentSource: PaymentSource) {
    return {
        id: paymentSource.id,
        workspace_id: paymentSource.workspaceId,
        name: paymentSource.name,
        type: paymentSource.type,
        created_at: paymentSource.createdAt.toISOString(),
        updated_at: paymentSource.updatedAt.toISOString(),
        archived_at: paymentSource.deletedAt?.toISOString() ?? null,
    }
}
