import { Injectable } from '@nestjs/common'
import { Prisma, Workspace, WorkspaceMembership } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { seedCategoriesForWorkspace } from '../workspaces/seeds/01_default_categories'

export interface CreateWorkspaceInput {
    name: string
    type: string
    timezone: string
    baseCurrency?: string
}

export interface CreateWorkspaceMembershipInput {
    userId: string
    workspaceId: string
    role: string
    lastPaymentSourceId: string
}

export interface UpdateWorkspaceSettingsInput {
    workspaceId: string
    name?: string
    timezone: string
    baseCurrency?: string
}

export interface WorkspaceMembershipAccess {
    workspaceId: string
    role: string
}

export type UserWorkspaceRecord = Workspace & {
    lastPaymentSourceId: string
    baseCurrencyLocked: boolean
}

export type WorkspaceDetailsRecord = Workspace & {
    baseCurrencyLocked: boolean
}

export type WorkspacePersistenceClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class WorkspaceRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findWorkspacesByUserId(userId: string): Promise<UserWorkspaceRecord[]> {
        const workspaces = await this.prisma.workspace.findMany({
            where: {
                memberships: {
                    some: {
                        userId,
                    },
                },
            },
            include: {
                memberships: {
                    where: { userId },
                    select: { lastPaymentSourceId: true },
                },
                _count: {
                    select: {
                        transactions: true,
                        budgets: true,
                    },
                },
            },
            orderBy: [
                {
                    createdAt: 'asc',
                },
                {
                    id: 'asc',
                },
            ],
        })

        return workspaces.map(({ memberships, _count, ...workspace }) => ({
            ...workspace,
            lastPaymentSourceId: memberships[0].lastPaymentSourceId,
            baseCurrencyLocked: _count.transactions > 0 || _count.budgets > 0,
        }))
    }

    async findWorkspaceById(
        workspaceId: string,
        prisma: WorkspacePersistenceClient = this.prisma,
    ): Promise<WorkspaceDetailsRecord | null> {
        const workspace = await prisma.workspace.findUnique({
            where: {
                id: workspaceId,
            },
            include: {
                _count: {
                    select: {
                        transactions: true,
                        budgets: true,
                    },
                },
            },
        })

        if (!workspace) return null

        const { _count, ...details } = workspace
        return {
            ...details,
            baseCurrencyLocked: _count.transactions > 0 || _count.budgets > 0,
        }
    }

    async updateWorkspaceSettings(
        input: UpdateWorkspaceSettingsInput,
        prisma: WorkspacePersistenceClient = this.prisma,
    ): Promise<Workspace> {
        return prisma.workspace.update({
            where: {
                id: input.workspaceId,
            },
            data: {
                name: input.name,
                timezone: input.timezone,
                baseCurrency: input.baseCurrency,
            },
        })
    }

    async findWorkspaceAccess(
        userId: string,
        workspaceId: string,
    ): Promise<WorkspaceMembershipAccess | null> {
        return this.prisma.workspaceMembership
            .findFirst({
                where: {
                    userId,
                    workspaceId,
                },
                select: {
                    role: true,
                    workspace: {
                        select: {
                            id: true,
                        },
                    },
                },
            })
            .then((membership) => {
                if (!membership) {
                    return null
                }

                return {
                    workspaceId: membership.workspace.id,
                    role: membership.role,
                }
            })
    }

    async checkMembership(userId: string, workspaceId: string): Promise<boolean> {
        const membershipCount = await this.prisma.workspaceMembership.count({
            where: {
                userId,
                workspaceId,
            },
        })

        return membershipCount > 0
    }

    async createWorkspace(
        input: CreateWorkspaceInput,
        prisma: WorkspacePersistenceClient = this.prisma,
    ): Promise<Workspace> {
        return prisma.workspace.create({
            data: {
                name: input.name,
                type: input.type,
                timezone: input.timezone,
                baseCurrency: input.baseCurrency,
            },
        })
    }

    async createWorkspaceMembership(
        input: CreateWorkspaceMembershipInput,
        prisma: WorkspacePersistenceClient = this.prisma,
    ): Promise<WorkspaceMembership> {
        return prisma.workspaceMembership.create({
            data: {
                userId: input.userId,
                workspaceId: input.workspaceId,
                role: input.role,
                lastPaymentSourceId: input.lastPaymentSourceId,
            },
        })
    }

    async createDefaultCashPaymentSource(
        workspaceId: string,
        prisma: WorkspacePersistenceClient = this.prisma,
    ) {
        return prisma.paymentSource.create({
            data: {
                workspaceId,
                name: 'Cash',
                type: 'cash',
                systemKey: 'cash',
            },
        })
    }
    async seedDefaultCategories(
        workspaceId: string,
        prisma: WorkspacePersistenceClient = this.prisma,
    ): Promise<void> {
        await seedCategoriesForWorkspace(workspaceId, prisma)
    }
}
