import { applyDecorators } from '@nestjs/common'
import { ApiExtension, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger'
import type { OpenAPIObject } from '@nestjs/swagger'

type SchemaObject = Exclude<
    NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>[string],
    { $ref: string }
>

type Operation = 'create' | 'get' | 'update' | 'delete' | 'categories' | 'payment-sources'
const text = (nullable = false) => ({ type: 'string', ...(nullable ? { nullable: true } : {}) })
const object = (properties: Record<string, SchemaObject>): SchemaObject => ({
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
})
export const externalTransactionSchema = object({
    id: text(),
    external_id: text(true),
    version: { type: 'integer', minimum: 1 },
    category_id: text(true),
    payment_source_id: text(),
    type: { type: 'string', enum: ['expense', 'income'] },
    amount: { type: 'string', pattern: '^\\d+\\.\\d{2}$', example: '12.34' },
    currency: text(),
    date: { type: 'string', format: 'date' },
    description: text(),
    notes: text(true),
    tags: { type: 'array', items: text() },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    replayed: { type: 'boolean' },
})
export const externalCategorySchema = object({
    id: text(),
    name: text(),
    type: text(),
    system_key: text(true),
    parent_id: text(true),
    icon: text(true),
    color: text(true),
    sort_order: { type: 'integer' },
})
export const externalPaymentSourceSchema = object({
    id: text(),
    name: text(),
    type: text(),
    system_key: text(true),
})
const acknowledgement = object({
    status: { type: 'string', enum: ['already_exists'] },
    external_id: text(),
})
const errorSchema = object({
    statusCode: { type: 'integer' },
    message: { oneOf: [text(), { type: 'array', items: text() }] },
    error: text(),
    code: text(),
})
const cacheHeaders = {
    'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } },
    Pragma: { schema: { type: 'string', enum: ['no-cache'] } },
}
const etagHeader = {
    ETag: {
        description: 'Original strong transaction version, including on replay.',
        schema: { type: 'string', example: '"tx-v1"' },
    },
}
const retryHeader = {
    'Retry-After': {
        description: 'Seconds to wait. Present on active claims and all rate-limit responses.',
        schema: { type: 'integer', minimum: 1 },
    },
}
const operations = {
    create: {
        summary: 'Create a transaction owned by this integration',
        scope: 'transactions:create',
    },
    get: {
        summary: 'Get one integration-owned transaction by exact external ID',
        scope: 'transactions:read-own',
    },
    update: {
        summary: 'Replace one integration-owned transaction',
        scope: 'transactions:update-own',
    },
    delete: {
        summary: 'Soft-delete one integration-owned transaction',
        scope: 'transactions:delete-own',
    },
    categories: {
        summary: 'List minimal active categories allowed by this credential',
        scope: 'categories:read',
    },
    'payment-sources': {
        summary: 'List minimal active payment sources allowed by this credential',
        scope: 'payment-sources:read',
    },
}

/** Keep the public status/header/schema contract beside the dedicated machine controller. */
export function ApiExternalOperation(operation: Operation) {
    const definition = operations[operation]
    const decorators: Array<ClassDecorator | MethodDecorator> = [
        ApiOperation({
            summary: definition.summary,
            description: `Requires exactly ${definition.scope}. No other scope is implied.`,
            operationId: `external_${operation.replace('-', '_')}`,
        }),
        ApiExtension('x-required-scope', definition.scope),
        ...Object.entries({
            400: 'Invalid headers, query, DTO, references or restrictions.',
            401: 'Missing, invalid, expired, revoked or network-disallowed credential.',
            403: 'Authenticated credential lacks the exact scope.',
            404: 'Workspace or transaction is missing or inaccessible; no ownership disclosure.',
            429: 'Shared credential or source rate limit exceeded.',
            503: 'Authoritative authentication or rate-limit persistence is unavailable; no mutation occurs.',
        }).map(([status, description]) =>
            ApiResponse({
                status: Number(status),
                description,
                schema: errorSchema,
                headers: {
                    ...cacheHeaders,
                    ...(status === '401'
                        ? { 'WWW-Authenticate': { schema: { type: 'string', enum: ['Bearer'] } } }
                        : {}),
                    ...(status === '429' ? retryHeader : {}),
                },
            }),
        ),
    ]
    if (['get', 'update', 'delete'].includes(operation))
        decorators.push(
            ApiParam({
                name: 'externalId',
                description:
                    'URL-encoded, trimmed, case-sensitive source ID, 1 to 200 UTF-8 bytes.',
                type: String,
            }),
        )
    if (['create', 'update', 'delete'].includes(operation))
        decorators.push(
            ApiResponse({
                status: 409,
                description: 'Conflicting request-key reuse, or a live claim (Retry-After: 1).',
                schema: errorSchema,
                headers: { ...cacheHeaders, ...retryHeader },
            }),
        )
    if (['create', 'update'].includes(operation)) {
        decorators.push(
            ApiResponse({
                status: 413,
                description: 'JSON request exceeds 64 KiB.',
                schema: errorSchema,
                headers: cacheHeaders,
            }),
        )
        decorators.push(
            ApiResponse({
                status: 415,
                description: 'Content-Type must be application/json.',
                schema: errorSchema,
                headers: cacheHeaders,
            }),
        )
    }
    if (['update', 'delete'].includes(operation)) {
        decorators.push(
            ApiResponse({
                status: 412,
                description: 'Stale version on an accessible owned transaction.',
                schema: errorSchema,
                headers: cacheHeaders,
            }),
        )
        decorators.push(
            ApiResponse({
                status: 428,
                description: 'If-Match is absent; malformed values return 400.',
                schema: errorSchema,
                headers: cacheHeaders,
            }),
        )
    }
    if (operation === 'create') {
        decorators.push(
            ApiResponse({
                status: 201,
                description: 'Created, or replay of the original create result.',
                schema: externalTransactionSchema,
                headers: { ...cacheHeaders, ...etagHeader },
            }),
        )
        decorators.push(
            ApiResponse({
                status: 200,
                description:
                    'Known external ID; no financial fields, version or deletion status disclosed.',
                schema: acknowledgement,
                headers: cacheHeaders,
            }),
        )
    } else if (operation === 'delete')
        decorators.push(
            ApiResponse({
                status: 204,
                description: 'Soft-deleted, or identical completed retry. No body.',
                headers: cacheHeaders,
            }),
        )
    else
        decorators.push(
            ApiResponse({
                status: 200,
                schema:
                    operation === 'categories'
                        ? { type: 'array', items: externalCategorySchema }
                        : operation === 'payment-sources'
                          ? { type: 'array', items: externalPaymentSourceSchema }
                          : externalTransactionSchema,
                headers: {
                    ...cacheHeaders,
                    ...(['get', 'update'].includes(operation) ? etagHeader : {}),
                },
            }),
        )
    return applyDecorators(...decorators)
}
