export const INTEGRATION_SCOPES = [
    'transactions:create',
    'transactions:read-own',
    'transactions:update-own',
    'transactions:delete-own',
    'categories:read',
    'payment-sources:read',
] as const

export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number]

const IMPLEMENTED_INTEGRATION_SCOPES = new Set<IntegrationScope>([
    'transactions:create',
    'categories:read',
    'payment-sources:read',
    'transactions:read-own',
    'transactions:update-own',
    'transactions:delete-own',
])

export function isIntegrationScope(value: string): value is IntegrationScope {
    return (INTEGRATION_SCOPES as readonly string[]).includes(value)
}

export function areInitialIntegrationScopes(scopes: readonly string[]): boolean {
    return scopes.every(
        (scope): scope is IntegrationScope =>
            isIntegrationScope(scope) && IMPLEMENTED_INTEGRATION_SCOPES.has(scope),
    )
}

export function normalizeIntegrationScopes(scopes: readonly string[]): IntegrationScope[] {
    const normalized = [...new Set(scopes.map((scope) => scope.trim()))]
    if (!areInitialIntegrationScopes(normalized)) {
        throw new Error('Integration scopes contain an unsupported capability')
    }
    return normalized.sort() as IntegrationScope[]
}
