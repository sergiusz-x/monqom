import { ApiResponse } from '@nestjs/swagger'

type Schema = Record<string, unknown>
const string = (format?: string, nullable = false): Schema => ({
    type: 'string',
    ...(format ? { format } : {}),
    ...(nullable ? { nullable: true } : {}),
})
const number = (nullable = false): Schema => ({
    type: 'number',
    ...(nullable ? { nullable: true } : {}),
})
const integer = (nullable = false): Schema => ({
    type: 'integer',
    ...(nullable ? { nullable: true } : {}),
})
const boolean = (): Schema => ({ type: 'boolean' })
const array = (items: Schema): Schema => ({ type: 'array', items })
const object = (
    properties: Record<string, Schema>,
    required = Object.keys(properties),
): Schema => ({ type: 'object', properties, required })

const user = object({
    id: string(),
    email: string('email'),
    name: string(),
    locale: string(),
    hideSalaryAmounts: boolean(),
    emailVerified: boolean(),
    totpEnabled: boolean(),
    createdAt: string('date-time'),
    updatedAt: string('date-time'),
})
const workspace = object(
    {
        id: string(),
        name: string(),
        type: string(),
        timezone: string(),
        baseCurrency: string(),
        createdAt: string('date-time'),
        updatedAt: string('date-time'),
        lastPaymentSourceId: string(undefined, true),
        baseCurrencyLocked: boolean(),
        role: { type: 'string', enum: ['member', 'admin', 'owner'] },
    },
    [
        'id',
        'name',
        'type',
        'timezone',
        'baseCurrency',
        'createdAt',
        'updatedAt',
        'baseCurrencyLocked',
    ],
)
const categoryBase = {
    id: string(),
    name: string(),
    system_key: string(undefined, true),
    type: { type: 'string', enum: ['expense', 'income'] },
    icon: string(undefined, true),
    parent_id: string(undefined, true),
    sort_order: integer(),
    is_archived: boolean(),
    archived_at: string('date-time', true),
}
const category = object({
    ...categoryBase,
    children: array(object({ ...categoryBase, children: array(object(categoryBase)) })),
})
const paymentSource = object({
    id: string(),
    workspace_id: string(),
    name: string(),
    type: { type: 'string', enum: ['cash', 'debit_card', 'credit_card', 'bank', 'other'] },
    system_key: string(undefined, true),
    is_archived: boolean(),
    archived_at: string('date-time', true),
    created_at: string('date-time'),
    updated_at: string('date-time'),
})
const budget = object({
    id: string(),
    workspace_id: string(),
    category_id: string(undefined, true),
    amount: number(),
    currency: string(),
    year: integer(),
    month: integer(),
    created_at: string('date-time'),
    updated_at: string('date-time'),
})
const budgetProgress = object({
    category_id: string(),
    category_name: string(),
    category_system_key: string(undefined, true),
    budget_amount: number(true),
    limit: number(true),
    spent: number(),
    remaining: number(true),
    percentage: number(true),
})
const transaction = object({
    id: string(),
    workspace_id: string(),
    category_id: string(),
    payment_source_id: string(),
    type: { type: 'string', enum: ['expense', 'income'] },
    amount: number(),
    currency: string(),
    date: string('date'),
    description: string(),
    notes: string(undefined, true),
    tags: array(string()),
    created_at: string('date-time'),
    updated_at: string('date-time'),
})
const spendingSummary = object({
    month: string(),
    currency: string(),
    current_total: number(),
    previous_total: number(),
    change_amount: number(),
    change_percentage: number(true),
    direction: { type: 'string', enum: ['up', 'down', 'flat'] },
    income_total: number(),
    net_total: number(),
})
const categoryBreakdown = object({
    month: string(),
    currency: string(),
    total_spending: number(),
    categories: array(
        object({
            category_id: string(),
            category_name: string(),
            category_system_key: string(undefined, true),
            category_color: string(undefined, true),
            amount: number(),
            percentage: number(),
        }),
    ),
})
const goalOperation = object({
    id: string(),
    goal_id: string(),
    type: { type: 'string', enum: ['deposit', 'withdrawal'] },
    amount: number(),
    date: string('date'),
    note: string(undefined, true),
    created_at: string('date-time'),
    updated_at: string('date-time'),
})
const goal = object(
    {
        id: string(),
        workspace_id: string(),
        name: string(),
        target_amount: number(),
        initial_amount: number(),
        currency: string(),
        target_date: string('date'),
        plan_start_month: string(),
        archived_at: string('date-time', true),
        current_amount: number(),
        remaining_amount: number(),
        progress_percentage: number(),
        remaining_months: integer(),
        recommended_monthly_amount: number(true),
        status: { type: 'string', enum: ['active', 'completed', 'overdue'] },
        operations: array(goalOperation),
        created_at: string('date-time'),
        updated_at: string('date-time'),
    },
    [
        'id',
        'workspace_id',
        'name',
        'target_amount',
        'initial_amount',
        'currency',
        'target_date',
        'plan_start_month',
        'archived_at',
        'current_amount',
        'remaining_amount',
        'progress_percentage',
        'remaining_months',
        'recommended_monthly_amount',
        'status',
        'created_at',
        'updated_at',
    ],
)

function response(schema: Schema, status = 200) {
    return ApiResponse({ status, schema })
}
export const ApiMessageResponse = (status = 200) => response(object({ message: string() }), status)
export const ApiUserResponse = (status = 200) => response(user, status)
export const ApiLoginResponse = () =>
    response({ oneOf: [user, object({ requiresTwoFactor: boolean(), message: string() })] })
export const ApiCsrfResponse = () => response(object({ csrfToken: string() }))
export const ApiTwoFactorSetupResponse = () =>
    response(object({ secret: string(), otpauthUri: string(), qrCodeDataUrl: string() }))
export const ApiTwoFactorLoginResponse = () =>
    response(
        object({
            ...(user as { properties: Record<string, Schema> }).properties,
            recoveryCodeUsed: boolean(),
        }),
    )
export const ApiTwoFactorVerifySetupResponse = () =>
    response(object({ message: string(), recoveryCodes: array(string()) }))
export const ApiWorkspaceResponse = (many = false) => response(many ? array(workspace) : workspace)
export const ApiCategoryResponse = (many = false, status = 200) =>
    response(many ? array(category) : category, status)
export const ApiPaymentSourceResponse = (many = false, status = 200) =>
    response(many ? array(paymentSource) : paymentSource, status)
export const ApiBudgetResponse = (many = false, status = 200) =>
    response(many ? array(budget) : budget, status)
export const ApiBudgetProgressResponse = () => response(array(budgetProgress))
export const ApiTransactionResponse = (status = 200) => response(transaction, status)
export const ApiTransactionsPageResponse = () =>
    response(
        object({ data: array(transaction), total: integer(), limit: integer(), offset: integer() }),
    )
export const ApiStringArrayResponse = () => response(array(string()))
export const ApiSpendingSummaryResponse = () => response(spendingSummary)
export const ApiCategoryBreakdownResponse = () => response(categoryBreakdown)
export const ApiDashboardResponse = () =>
    response(
        object({
            summary: spendingSummary,
            category_breakdown: categoryBreakdown,
            spending_trend: array(object({ month: string(), total: number() })),
            recent_transactions: array(transaction),
        }),
    )
export const ApiGoalResponse = (many = false, status = 200) =>
    response(many ? array(goal) : goal, status)
export const ApiGoalOperationResponse = (status = 200) => response(goalOperation, status)
