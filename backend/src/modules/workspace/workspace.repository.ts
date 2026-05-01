import { Injectable } from '@nestjs/common'
import { Prisma, Workspace, WorkspaceMembership } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { seedCategoriesForWorkspace } from '../workspaces/seeds/01_default_categories'

export interface CreateWorkspaceInput {
    name: string
    type: string
    timezone: string
}

export interface CreateWorkspaceMembershipInput {
    userId: string
    workspaceId: string
    role: string
}

export interface UpdateWorkspaceSettingsInput {
    workspaceId: string
    timezone: string
}

export interface WorkspaceMembershipAccess {
    workspaceId: string
    role: string
}

export type WorkspacePersistenceClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class WorkspaceRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findWorkspacesByUserId(userId: string): Promise<Workspace[]> {
        return this.prisma.workspace.findMany({
            where: {
                memberships: {
                    some: {
                        userId,
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
    }

    async findWorkspaceById(workspaceId: string): Promise<Workspace | null> {
        return this.prisma.workspace.findUnique({
            where: {
                id: workspaceId,
            },
        })
    }

    async updateWorkspaceSettings(input: UpdateWorkspaceSettingsInput): Promise<Workspace> {
        return this.prisma.workspace.update({
            where: {
                id: input.workspaceId,
            },
            data: {
                timezone: input.timezone,
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
