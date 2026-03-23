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

export type WorkspacePersistenceClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class WorkspaceRepository {
    constructor(private readonly prisma: PrismaService) {}

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
