import { Injectable } from '@nestjs/common'
import { Category, PaymentSource, Prisma, Transaction, TransactionTag } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'

export interface CreateTransactionRecordInput {
    workspaceId: string
    userId: string
    categoryId: string
    paymentSourceId?: string
    type: string
    amount: number
    currency: string
    date: Date
    notes: string | null
    tags: string[]
}

export interface ListTransactionsFilters {
    workspaceId: string
    categoryId?: string
    paymentSourceId?: string
    tag?: string
    dateFrom?: Date
    dateTo?: Date
}

export interface ListTransactionsQuery extends ListTransactionsFilters {
    limit: number
    offset: number
}

export type TransactionsPersistenceClient = Prisma.TransactionClient | PrismaService
export type TransactionWithTags = Transaction & {
    tags: TransactionTag[]
}

export interface ListedTransactionRecord {
    id: string
    workspace_id: string
    category_id: string
    payment_source_id: string | null
    type: string
    amount: number
    currency: string
    date: Date
    notes: string | null
    created_at: Date
    updated_at: Date
    tags: string[]
}

interface NormalizedTagRow {
    name: string
}

interface CountRow {
    total: number
}

interface WorkspaceTagRow {
    name: string
}

@Injectable()
export class TransactionsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findCategoryById(
        workspaceId: string,
        categoryId: string,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<Category | null> {
        return prisma.category.findFirst({
            where: {
                workspaceId,
                id: categoryId,
            },
        })
    }

    async findActivePaymentSourceById(
        workspaceId: string,
        paymentSourceId: string,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<PaymentSource | null> {
        return prisma.paymentSource.findFirst({
            where: {
                workspaceId,
                id: paymentSourceId,
                deletedAt: null,
            },
        })
    }

    async createTransactionWithTags(
        input: CreateTransactionRecordInput,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<TransactionWithTags> {
        const createTransactionRecord = async (
            tx: TransactionsPersistenceClient,
        ): Promise<TransactionWithTags> => {
            const normalizedTags = await this.normalizeTagsCaseInsensitive(input.tags, tx)

            const transaction = await tx.transaction.create({
                data: {
                    workspaceId: input.workspaceId,
                    categoryId: input.categoryId,
                    paymentSourceId: input.paymentSourceId ?? null,
                    type: input.type,
                    amount: input.amount,
                    currency: input.currency,
                    date: input.date,
                    notes: input.notes,
                },
            })

            const tags = await Promise.all(
                normalizedTags.map((name) =>
                    tx.transactionTag.create({
                        data: {
                            workspaceId: input.workspaceId,
                            transactionId: transaction.id,
                            name,
                        },
                    }),
                ),
            )

            await tx.auditEvent.create({
                data: {
                    action: 'TRANSACTION_CREATED',
                    workspaceId: input.workspaceId,
                    userId: input.userId,
                    entityType: 'TRANSACTION',
                    entityId: transaction.id,
                    metadata: {
                        type: input.type,
                        amount: input.amount,
                        currency: input.currency,
                        date: input.date.toISOString(),
                        category_id: input.categoryId,
                        ...(input.paymentSourceId
                            ? {
                                  payment_source_id: input.paymentSourceId,
                              }
                            : {}),
                        ...(input.notes
                            ? {
                                  notes: input.notes,
                              }
                            : {}),
                        tags: normalizedTags,
                    },
                },
            })

            return {
                ...transaction,
                tags,
            }
        }

        if (prisma === this.prisma) {
            return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
                createTransactionRecord(tx),
            )
        }

        return createTransactionRecord(prisma)
    }

    async listTransactions(
        filters: ListTransactionsQuery,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<ListedTransactionRecord[]> {
        const whereClause = buildTransactionsWhereClause(filters)

        return prisma.$queryRaw<ListedTransactionRecord[]>(Prisma.sql`
            SELECT
                t."id",
                t."workspace_id",
                t."category_id",
                t."payment_source_id",
                t."type",
                t."amount",
                t."currency",
                t."date",
                t."notes",
                t."created_at",
                t."updated_at",
                COALESCE(
                    ARRAY_AGG(DISTINCT tt."name" ORDER BY tt."name") FILTER (WHERE tt."id" IS NOT NULL),
                    ARRAY[]::TEXT[]
                ) AS "tags"
            FROM "transactions" t
            LEFT JOIN "transaction_tags" tt
                ON tt."workspace_id" = t."workspace_id"
                AND tt."transaction_id" = t."id"
            ${whereClause}
            GROUP BY
                t."id",
                t."workspace_id",
                t."category_id",
                t."payment_source_id",
                t."type",
                t."amount",
                t."currency",
                t."date",
                t."notes",
                t."created_at",
                t."updated_at"
            ORDER BY t."date" DESC, t."created_at" DESC
            LIMIT ${filters.limit}
            OFFSET ${filters.offset}
        `)
    }

    async countTransactions(
        filters: ListTransactionsFilters,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<number> {
        const whereClause = buildTransactionsWhereClause(filters)
        const rows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
            SELECT COUNT(*)::INT AS "total"
            FROM "transactions" t
            ${whereClause}
        `)

        return rows[0]?.total ?? 0
    }

    async listWorkspaceTags(
        workspaceId: string,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<string[]> {
        const rows = await prisma.$queryRaw<WorkspaceTagRow[]>(Prisma.sql`
            SELECT DISTINCT BTRIM(tt."name") AS "name"
            FROM "transaction_tags" tt
            INNER JOIN "transactions" t
                ON t."workspace_id" = tt."workspace_id"
                AND t."id" = tt."transaction_id"
            WHERE tt."workspace_id" = ${workspaceId}
                AND t."deleted_at" IS NULL
                AND LENGTH(BTRIM(tt."name")) > 0
            ORDER BY "name" ASC
        `)

        return rows.map((row) => row.name)
    }

    async normalizeTagsCaseInsensitive(
        tags: string[],
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<string[]> {
        if (tags.length === 0) {
            return []
        }

        const values = tags.map((tag, index) => Prisma.sql`(${index}, ${tag})`)
        const rows = await prisma.$queryRaw<NormalizedTagRow[]>(Prisma.sql`
            WITH input_tags(position, name) AS (
                VALUES ${Prisma.join(values)}
            )
            SELECT DISTINCT ON (LOWER(BTRIM(name)))
                BTRIM(name) AS name
            FROM input_tags
            WHERE LENGTH(BTRIM(name)) > 0
            ORDER BY LOWER(BTRIM(name)), position ASC
        `)

        return rows.map((row) => row.name)
    }
}

function buildTransactionsWhereClause(filters: ListTransactionsFilters): Prisma.Sql {
    let whereClause = Prisma.sql`
        WHERE t."workspace_id" = ${filters.workspaceId}
            AND t."deleted_at" IS NULL
    `

    if (filters.categoryId) {
        whereClause = Prisma.sql`${whereClause} AND t."category_id" = ${filters.categoryId}`
    }

    if (filters.paymentSourceId) {
        whereClause = Prisma.sql`${whereClause} AND t."payment_source_id" = ${filters.paymentSourceId}`
    }

    if (filters.tag) {
        whereClause = Prisma.sql`
            ${whereClause}
            AND EXISTS (
                SELECT 1
                FROM "transaction_tags" tt_filter
                WHERE tt_filter."workspace_id" = t."workspace_id"
                    AND tt_filter."transaction_id" = t."id"
                    AND LOWER(BTRIM(tt_filter."name")) = LOWER(BTRIM(${filters.tag}))
            )
        `
    }

    if (filters.dateFrom) {
        whereClause = Prisma.sql`${whereClause} AND t."date" >= ${filters.dateFrom}`
    }

    if (filters.dateTo) {
        whereClause = Prisma.sql`${whereClause} AND t."date" <= ${filters.dateTo}`
    }

    return whereClause
}
