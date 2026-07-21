import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { PaymentSource } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { PaymentSourcesRepository } from './payment-sources.repository'

const PAYMENT_SOURCE_NOT_FOUND_MESSAGE = 'Payment source not found'
const PAYMENT_SOURCE_NAME_CONFLICT_MESSAGE =
    'An active payment source with this name already exists'
const SYSTEM_CASH_PROTECTED_MESSAGE = 'The system cash payment source cannot be changed or archived'
const PAYMENT_SOURCE_TYPES = ['cash', 'debit_card', 'credit_card', 'bank', 'other'] as const

export interface PaymentSourceCommand {
    name: string
    type: (typeof PAYMENT_SOURCE_TYPES)[number]
}

export interface ListPaymentSourcesCommand {
    includeArchived?: boolean
}

export interface PaymentSourceResponse {
    id: string
    workspace_id: string
    name: string
    type: string
    system_key: string | null
    is_archived: boolean
    archived_at: Date | null
    created_at: Date
    updated_at: Date
}

interface ValidatedPaymentSourceInput {
    name?: string
    type?: PaymentSourceCommand['type']
    errors: string[]
}

@Injectable()
export class PaymentSourcesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentSourcesRepository: PaymentSourcesRepository,
    ) {}

    async listPaymentSources(
        input: ListPaymentSourcesCommand,
        workspaceId: string,
    ): Promise<PaymentSourceResponse[]> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const includeArchived = input.includeArchived ?? false
        const paymentSources = await this.paymentSourcesRepository.listPaymentSourcesByWorkspace(
            normalizedWorkspaceId,
            includeArchived,
            this.prisma,
        )

        return paymentSources.map((paymentSource) => mapPaymentSourceResponse(paymentSource))
    }

    async createPaymentSource(
        input: PaymentSourceCommand,
        workspaceId: string,
        userId: string,
    ): Promise<PaymentSourceResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')
        const validatedInput = validatePaymentSourceInput(input)

        if (validatedInput.errors.length > 0 || !validatedInput.name || !validatedInput.type) {
            throw new BadRequestException(validatedInput.errors)
        }

        const duplicate = await this.paymentSourcesRepository.findActivePaymentSourceByName(
            normalizedWorkspaceId,
            validatedInput.name,
            undefined,
            this.prisma,
        )
        if (duplicate) {
            throw new ConflictException(PAYMENT_SOURCE_NAME_CONFLICT_MESSAGE)
        }

        const paymentSource = await this.paymentSourcesRepository.createPaymentSource(
            {
                workspaceId: normalizedWorkspaceId,
                userId: normalizedUserId,
                name: validatedInput.name,
                type: validatedInput.type,
            },
            this.prisma,
        )

        return mapPaymentSourceResponse(paymentSource)
    }

    async updatePaymentSource(
        input: PaymentSourceCommand,
        paymentSourceId: string,
        workspaceId: string,
        userId: string,
    ): Promise<PaymentSourceResponse> {
        const normalizedPaymentSourceId = normalizeRequiredValue(
            paymentSourceId,
            'Payment source id',
        )
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')
        const validatedInput = validatePaymentSourceInput(input)

        if (validatedInput.errors.length > 0 || !validatedInput.name || !validatedInput.type) {
            throw new BadRequestException(validatedInput.errors)
        }

        const { name, type } = validatedInput

        return this.prisma.$transaction(async (tx) => {
            const existingPaymentSource = await this.paymentSourcesRepository.findPaymentSourceById(
                normalizedWorkspaceId,
                normalizedPaymentSourceId,
                false,
                tx,
            )

            if (!existingPaymentSource) {
                throw new NotFoundException(PAYMENT_SOURCE_NOT_FOUND_MESSAGE)
            }
            if (existingPaymentSource.systemKey === 'cash') {
                throw new ConflictException(SYSTEM_CASH_PROTECTED_MESSAGE)
            }

            const duplicate = await this.paymentSourcesRepository.findActivePaymentSourceByName(
                normalizedWorkspaceId,
                name,
                normalizedPaymentSourceId,
                tx,
            )
            if (duplicate) {
                throw new ConflictException(PAYMENT_SOURCE_NAME_CONFLICT_MESSAGE)
            }

            const updatedPaymentSource = await this.paymentSourcesRepository.updatePaymentSource(
                {
                    workspaceId: normalizedWorkspaceId,
                    paymentSourceId: normalizedPaymentSourceId,
                    userId: normalizedUserId,
                    name,
                    type,
                    previousPaymentSource: existingPaymentSource,
                },
                tx,
            )

            if (!updatedPaymentSource) {
                throw new NotFoundException(PAYMENT_SOURCE_NOT_FOUND_MESSAGE)
            }

            return mapPaymentSourceResponse(updatedPaymentSource)
        })
    }

    async archivePaymentSource(
        paymentSourceId: string,
        workspaceId: string,
        userId: string,
    ): Promise<PaymentSourceResponse> {
        const normalizedPaymentSourceId = normalizeRequiredValue(
            paymentSourceId,
            'Payment source id',
        )
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')

        return this.prisma.$transaction(async (tx) => {
            const existingPaymentSource = await this.paymentSourcesRepository.findPaymentSourceById(
                normalizedWorkspaceId,
                normalizedPaymentSourceId,
                false,
                tx,
            )

            if (!existingPaymentSource) {
                throw new NotFoundException(PAYMENT_SOURCE_NOT_FOUND_MESSAGE)
            }
            if (existingPaymentSource.systemKey === 'cash') {
                throw new ConflictException(SYSTEM_CASH_PROTECTED_MESSAGE)
            }

            const cashPaymentSource =
                await this.paymentSourcesRepository.findSystemCashPaymentSource(
                    normalizedWorkspaceId,
                    tx,
                )
            if (!cashPaymentSource) {
                throw new NotFoundException(PAYMENT_SOURCE_NOT_FOUND_MESSAGE)
            }

            const archivedAt = new Date()
            const wasArchived = await this.paymentSourcesRepository.archivePaymentSource(
                {
                    workspaceId: normalizedWorkspaceId,
                    paymentSourceId: normalizedPaymentSourceId,
                    userId: normalizedUserId,
                    archivedAt,
                    paymentSource: existingPaymentSource,
                },
                tx,
            )

            if (!wasArchived) {
                throw new NotFoundException(PAYMENT_SOURCE_NOT_FOUND_MESSAGE)
            }

            await this.paymentSourcesRepository.resetLastPaymentSourcePreferences(
                normalizedWorkspaceId,
                normalizedPaymentSourceId,
                cashPaymentSource.id,
                tx,
            )

            return mapPaymentSourceResponse({
                ...existingPaymentSource,
                deletedAt: archivedAt,
                updatedAt: archivedAt,
            })
        })
    }
}

function validatePaymentSourceInput(input: PaymentSourceCommand): ValidatedPaymentSourceInput {
    const errors: string[] = []

    return {
        name: validateNameValue(input.name, errors),
        type: input.type,
        errors,
    }
}

function validateNameValue(value: string, errors: string[]): string | undefined {
    if (value.trim().length === 0) {
        errors.push('Name is required')
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length > 100) {
        errors.push('Name must be 100 characters or fewer')
        return undefined
    }
    return normalized
}

function normalizeRequiredValue(value: string, fieldName: string): string {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        throw new BadRequestException(`${fieldName} is required`)
    }

    return normalizedValue
}

function mapPaymentSourceResponse(paymentSource: PaymentSource): PaymentSourceResponse {
    return {
        id: paymentSource.id,
        workspace_id: paymentSource.workspaceId,
        name: paymentSource.name,
        type: paymentSource.type,
        system_key: paymentSource.systemKey,
        is_archived: paymentSource.deletedAt !== null,
        archived_at: paymentSource.deletedAt,
        created_at: paymentSource.createdAt,
        updated_at: paymentSource.updatedAt,
    }
}
