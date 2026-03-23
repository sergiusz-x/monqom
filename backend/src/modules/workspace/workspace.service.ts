import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma, Workspace } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { WorkspacePersistenceClient, WorkspaceRepository } from './workspace.repository'

const PERSONAL_WORKSPACE_TYPE = 'personal'
const PERSONAL_WORKSPACE_TIMEZONE = 'UTC'
const PERSONAL_WORKSPACE_ROLE = 'owner'

@Injectable()
export class WorkspaceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly workspaceRepository: WorkspaceRepository,
    ) {}

    async createPersonalWorkspace(
        userId: string,
        userName: string,
        prisma: WorkspacePersistenceClient = this.prisma,
    ): Promise<Workspace> {
        const normalizedUserId = userId.trim()
        const normalizedUserName = userName.trim()

        if (normalizedUserId.length === 0) {
            throw new BadRequestException('User id is required')
        }

        if (normalizedUserName.length === 0) {
            throw new BadRequestException('User name is required')
        }

        const createWorkspace = async (tx: WorkspacePersistenceClient): Promise<Workspace> => {
            const workspace = await this.workspaceRepository.createWorkspace(
                {
                    name: `${normalizedUserName}'s Finances`,
                    type: PERSONAL_WORKSPACE_TYPE,
                    timezone: PERSONAL_WORKSPACE_TIMEZONE,
                },
                tx,
            )

            await this.workspaceRepository.createWorkspaceMembership(
                {
                    userId: normalizedUserId,
                    workspaceId: workspace.id,
                    role: PERSONAL_WORKSPACE_ROLE,
                },
                tx,
            )

            await this.workspaceRepository.seedDefaultCategories(workspace.id, tx)

            return workspace
        }

        if (prisma === this.prisma) {
            return this.prisma.$transaction((tx: Prisma.TransactionClient) => createWorkspace(tx))
        }

        return createWorkspace(prisma)
    }
}
