import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { Prisma, Workspace } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import {
    UserWorkspaceRecord,
    WorkspaceDetailsRecord,
    WorkspacePersistenceClient,
    WorkspaceRepository,
} from './workspace.repository'
import { normalizeCurrency } from '../../shared/currency/currency.service'

const PERSONAL_WORKSPACE_TYPE = 'personal'
const PERSONAL_WORKSPACE_TIMEZONE = 'UTC'
const PERSONAL_WORKSPACE_ROLE = 'owner'
const WORKSPACE_ACCESS_FORBIDDEN_MESSAGE = 'Forbidden'
const WORKSPACE_NOT_FOUND_MESSAGE = 'Workspace not found'
export const WORKSPACE_BASE_CURRENCY_LOCKED_CODE = 'WORKSPACE_BASE_CURRENCY_LOCKED'
const WORKSPACE_BASE_CURRENCY_LOCKED_MESSAGE =
    'Base currency cannot be changed after a transaction or budget has been created'

export interface UpdateWorkspaceSettingsCommand {
    name?: string
    timezone: string
    baseCurrency?: string
}

@Injectable()
export class WorkspaceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly workspaceRepository: WorkspaceRepository,
    ) {}

    async listUserWorkspaces(userId: string): Promise<UserWorkspaceRecord[]> {
        const normalizedUserId = this.normalizeRequiredValue(userId, 'User id')

        return this.workspaceRepository.findWorkspacesByUserId(normalizedUserId)
    }

    async getWorkspaceById(workspaceId: string): Promise<WorkspaceDetailsRecord> {
        const normalizedWorkspaceId = this.normalizeRequiredValue(workspaceId, 'Workspace id')

        const workspace = await this.workspaceRepository.findWorkspaceById(normalizedWorkspaceId)

        if (!workspace) {
            throw new NotFoundException(WORKSPACE_NOT_FOUND_MESSAGE)
        }

        return workspace
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

        return this.getWorkspaceById(normalizedWorkspaceId)
    }

    async updateWorkspaceSettings(
        workspaceId: string,
        input: UpdateWorkspaceSettingsCommand,
    ): Promise<Workspace> {
        const normalizedWorkspaceId = this.normalizeRequiredValue(workspaceId, 'Workspace id')
        const { name, timezone, baseCurrency, errors } = validateWorkspaceSettingsInput(input)

        if (errors.length > 0 || !timezone) {
            throw new BadRequestException(errors)
        }

        return this.prisma.$transaction(
            async (tx) => {
                const workspace = await this.workspaceRepository.findWorkspaceById(
                    normalizedWorkspaceId,
                    tx,
                )

                if (!workspace) {
                    throw new NotFoundException(WORKSPACE_NOT_FOUND_MESSAGE)
                }

                if (
                    baseCurrency !== undefined &&
                    baseCurrency !== workspace.baseCurrency &&
                    workspace.baseCurrencyLocked
                ) {
                    throw new ConflictException({
                        code: WORKSPACE_BASE_CURRENCY_LOCKED_CODE,
                        message: WORKSPACE_BASE_CURRENCY_LOCKED_MESSAGE,
                    })
                }

                const updated = await this.workspaceRepository.updateWorkspaceSettings(
                    {
                        workspaceId: normalizedWorkspaceId,
                        ...(name !== undefined ? { name } : {}),
                        timezone,
                        baseCurrency,
                    },
                    tx,
                )

                return {
                    ...updated,
                    baseCurrencyLocked: workspace.baseCurrencyLocked,
                }
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
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
        baseCurrency?: string,
    ): Promise<Workspace> {
        const normalizedUserId = this.normalizeRequiredValue(userId, 'User id')
        const normalizedUserName = this.normalizeRequiredValue(userName, 'User name')

        const createWorkspace = async (tx: WorkspacePersistenceClient): Promise<Workspace> => {
            const workspace = await this.workspaceRepository.createWorkspace(
                {
                    name: `${normalizedUserName}'s Finances`,
                    type: PERSONAL_WORKSPACE_TYPE,
                    timezone: PERSONAL_WORKSPACE_TIMEZONE,
                    ...(baseCurrency ? { baseCurrency: normalizeCurrency(baseCurrency) } : {}),
                },
                tx,
            )

            const cashPaymentSource = await this.workspaceRepository.createDefaultCashPaymentSource(
                workspace.id,
                tx,
            )

            await this.workspaceRepository.createWorkspaceMembership(
                {
                    userId: normalizedUserId,
                    workspaceId: workspace.id,
                    role: PERSONAL_WORKSPACE_ROLE,
                    lastPaymentSourceId: cashPaymentSource.id,
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

function validateWorkspaceSettingsInput(input: UpdateWorkspaceSettingsCommand): {
    name?: string
    timezone?: string
    baseCurrency?: string
    errors: string[]
} {
    const errors: string[] = []
    let name: string | undefined
    let timezone: string | undefined
    let baseCurrency: string | undefined

    if (input.name !== undefined) {
        const normalizedName = input.name.trim()

        if (normalizedName.length < 2) {
            errors.push('Workspace name must be at least 2 characters')
        } else if (normalizedName.length > 100) {
            errors.push('Workspace name must be 100 characters or fewer')
        } else {
            name = normalizedName
        }
    }

    if (input.timezone.trim().length === 0) {
        errors.push('Timezone is required')
    } else {
        timezone = input.timezone.trim()
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
        } catch {
            errors.push('Timezone must be a valid IANA timezone')
        }
    }

    if (input.baseCurrency !== undefined) {
        try {
            baseCurrency = normalizeCurrency(input.baseCurrency)
        } catch {
            errors.push('Base currency must be supported')
        }
    }

    return { name, timezone, baseCurrency, errors }
}
