import { areInitialIntegrationScopes, normalizeIntegrationScopes } from './integration-scopes'

describe('integration scopes', () => {
    it('accepts only scopes active in the first release', () => {
        expect(areInitialIntegrationScopes(['transactions:create', 'categories:read'])).toBe(true)
        expect(areInitialIntegrationScopes(['transactions:update-own'])).toBe(false)
        expect(areInitialIntegrationScopes(['*'])).toBe(false)
    })

    it('deduplicates scopes without broadening permissions', () => {
        expect(normalizeIntegrationScopes(['categories:read', 'categories:read'])).toEqual([
            'categories:read',
        ])
    })
})
