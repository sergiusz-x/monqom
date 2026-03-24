import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PaymentSource } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { PaymentSourcesRepository } from './payment-sources.repository'

const PAYMENT_SOURCE_NOT_FOUND_MESSAGE = 'Payment source not found'
const PAYMENT_SOURCE_TYPES = ['cash', 'debit_card', 'credit_card', 'bank', 'other'] as const

export interface PaymentSourceRequestInput {
    name?: unknown
    type?: unknown
}

export interface ListPaymentSourcesRequestInput {
    include_archived?: unknown
}

export interface PaymentSourceResponse {
    id: string
    workspace_id: string
    name: string
    type: string
    is_archived: boolean
    archived_at: Date | null
    created_at: Date
    updated_at: Date
}

interface ValidatedPaymentSourceInput {
    name?: string
    type?: string
    errors: string[]
}

@Injectable()
export class PaymentSourcesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentSourcesRepository: PaymentSourcesRepository,
    ) {}

    async listPaymentSources(
        input: ListPaymentSourcesRequestInput,
        workspaceId: string,
    ): Promise<PaymentSourceResponse[]> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const includeArchived = parseIncludeArchivedValue(input.include_archived)
        const paymentSources = await this.paymentSourcesRepository.listPaymentSourcesByWorkspace(
            normalizedWorkspaceId,
            includeArchived,
            this.prisma,
        )

        return paymentSources.map((paymentSource) => mapPaymentSourceResponse(paymentSource))
    }

    async createPaymentSource(
        input: PaymentSourceRequestInput,
        workspaceId: string,
        userId: string,
    ): Promise<PaymentSourceResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')
        const validatedInput = validatePaymentSourceInput(input)

        if (validatedInput.errors.length > 0 || !validatedInput.name || !validatedInput.type) {
            throw new BadRequestException(validatedInput.errors)
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
        input: PaymentSourceRequestInput,
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

            return mapPaymentSourceResponse({
                ...existingPaymentSource,
                deletedAt: archivedAt,
                updatedAt: archivedAt,
            })
        })
    }
}

function validatePaymentSourceInput(input: PaymentSourceRequestInput): ValidatedPaymentSourceInput {
    const errors: string[] = []

    return {
        name: validateNameValue(input.name, errors),
        type: validateTypeValue(input.type, errors),
        errors,
    }
}

function validateNameValue(value: unknown, errors: string[]): string | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push('Name is required')
        return undefined
    }

    return value.trim()
}

function validateTypeValue(value: unknown, errors: string[]): string | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push('Type is required')
        return undefined
    }

    const normalizedValue = value.trim()

    if (!PAYMENT_SOURCE_TYPES.includes(normalizedValue as (typeof PAYMENT_SOURCE_TYPES)[number])) {
        errors.push(`Type must be one of: ${PAYMENT_SOURCE_TYPES.join(', ')}`)
        return undefined
    }

    return normalizedValue
}

function parseIncludeArchivedValue(value: unknown): boolean {
    if (value === undefined || value === null) {
        return false
    }

    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value !== 'string') {
        throw new BadRequestException('include_archived must be true or false')
    }

    const normalizedValue = value.trim().toLowerCase()

    if (normalizedValue === 'true') {
        return true
    }

    if (normalizedValue === 'false') {
        return false
    }

    throw new BadRequestException('include_archived must be true or false')
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
        is_archived: paymentSource.deletedAt !== null,
        archived_at: paymentSource.deletedAt,
        created_at: paymentSource.createdAt,
        updated_at: paymentSource.updatedAt,
    }
}
