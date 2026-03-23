import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { Prisma, Workspace } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { WorkspacePersistenceClient, WorkspaceRepository } from './workspace.repository'

const PERSONAL_WORKSPACE_TYPE = 'personal'
const PERSONAL_WORKSPACE_TIMEZONE = 'UTC'
const PERSONAL_WORKSPACE_ROLE = 'owner'
const WORKSPACE_ACCESS_FORBIDDEN_MESSAGE = 'Forbidden'
const WORKSPACE_NOT_FOUND_MESSAGE = 'Workspace not found'

@Injectable()
export class WorkspaceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly workspaceRepository: WorkspaceRepository,
    ) {}

    async listUserWorkspaces(userId: string): Promise<Workspace[]> {
        const normalizedUserId = this.normalizeRequiredValue(userId, 'User id')

        return this.workspaceRepository.findWorkspacesByUserId(normalizedUserId)
    }

    async getWorkspaceForUser(userId: string, workspaceId: string): Promise<Workspace> {
        const normalizedUserId = this.normalizeRequiredValue(userId, 'User id')
        const normalizedWorkspaceId = this.normalizeRequiredValue(workspaceId, 'Workspace id')

        const isMember = await this.workspaceRepository.checkMembership(
            normalizedUserId,
            normalizedWorkspaceId,
        )

        if (!isMember) {
            throw new ForbiddenException(WORKSPACE_ACCESS_FORBIDDEN_MESSAGE)
        }

        const workspace = await this.workspaceRepository.findWorkspaceById(normalizedWorkspaceId)

        if (!workspace) {
            throw new NotFoundException(WORKSPACE_NOT_FOUND_MESSAGE)
        }

        return workspace
    }

    async checkMembership(userId: string, workspaceId: string): Promise<boolean> {
        const normalizedUserId = this.normalizeRequiredValue(userId, 'User id')
        const normalizedWorkspaceId = this.normalizeRequiredValue(workspaceId, 'Workspace id')

        return this.workspaceRepository.checkMembership(normalizedUserId, normalizedWorkspaceId)
    }

    async createPersonalWorkspace(
        userId: string,
        userName: string,
        prisma: WorkspacePersistenceClient = this.prisma,
    ): Promise<Workspace> {
        const normalizedUserId = this.normalizeRequiredValue(userId, 'User id')
        const normalizedUserName = this.normalizeRequiredValue(userName, 'User name')

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

    private normalizeRequiredValue(value: string, fieldName: string): string {
        const normalizedValue = value.trim()

        if (normalizedValue.length === 0) {
            throw new BadRequestException(`${fieldName} is required`)
        }

        return normalizedValue
    }
}
