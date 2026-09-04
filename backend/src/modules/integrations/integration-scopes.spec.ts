import { areSupportedIntegrationScopes, normalizeIntegrationScopes } from './integration-scopes'

describe('integration scopes', () => {
    it('accepts each exact lifecycle scope but no wildcard', () => {
        expect(areSupportedIntegrationScopes(['transactions:create', 'categories:read'])).toBe(true)
        expect(areSupportedIntegrationScopes(['transactions:update-own'])).toBe(true)
        expect(areSupportedIntegrationScopes(['transactions:delete-own'])).toBe(true)
        expect(areSupportedIntegrationScopes(['*'])).toBe(false)
    })

    it('deduplicates scopes without broadening permissions', () => {
        expect(normalizeIntegrationScopes(['categories:read', 'categories:read'])).toEqual([
            'categories:read',
        ])
    })
})
