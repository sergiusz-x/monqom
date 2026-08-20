import { createOpaqueDigest } from './opaque-digest'

describe('createOpaqueDigest', () => {
    it('creates deterministic, context-separated keyed digests', () => {
        const value = 'user@example.com'
        const secret = 'test-server-secret'

        const first = createOpaqueDigest(value, 'rate-limit:email', secret)

        expect(first).toHaveLength(64)
        expect(first).toBe(createOpaqueDigest(value, 'rate-limit:email', secret))
        expect(first).not.toBe(createOpaqueDigest(value, 'authentication-token', secret))
        expect(first).not.toContain(value)
    })

    it('rejects an empty server secret', () => {
        expect(() => createOpaqueDigest('value', 'context', '')).toThrow(
            'A server secret is required',
        )
    })
})
