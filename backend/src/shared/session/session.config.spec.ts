import {
    createSessionCookieClearingOptions,
    createSessionCookieOptions,
    createSessionOptions,
    SESSION_COOKIE_NAME,
    SESSION_TTL_MS,
} from './session.config'

describe('session.config', () => {
    it('configures session TTL to 30 days', () => {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
        expect(SESSION_TTL_MS).toBe(thirtyDaysMs)
    })

    describe('createSessionCookieOptions', () => {
        it('configures standard cookie options with 30-day maxAge', () => {
            const options = createSessionCookieOptions('development')

            expect(options).toEqual({
                httpOnly: true,
                maxAge: 30 * 24 * 60 * 60 * 1000,
                path: '/',
                sameSite: 'lax',
                secure: false,
            })
        })

        it('sets secure cookie flag in production', () => {
            const options = createSessionCookieOptions('production')

            expect(options.secure).toBe(true)
        })

        it('sets secure cookie flag in staging', () => {
            const options = createSessionCookieOptions('staging')

            expect(options.secure).toBe(true)
        })
    })

    describe('createSessionOptions', () => {
        it('enables rolling sessions and configures session store flags', () => {
            const options = createSessionOptions({
                nodeEnv: 'development',
                sessionSecret: 'test-session-secret-long-enough-32-chars',
            })

            expect(options.name).toBe(SESSION_COOKIE_NAME)
            expect(options.rolling).toBe(true)
            expect(options.resave).toBe(false)
            expect(options.saveUninitialized).toBe(false)
            const cookie = options.cookie as import('express-session').CookieOptions
            expect(cookie?.maxAge).toBe(30 * 24 * 60 * 60 * 1000)
            expect(cookie?.sameSite).toBe('lax')
            expect(cookie?.httpOnly).toBe(true)
        })

        it('throws if DATABASE_URL is missing in deployed environments', () => {
            expect(() =>
                createSessionOptions({
                    nodeEnv: 'production',
                    sessionSecret: 'test-session-secret-long-enough-32-chars',
                }),
            ).toThrow(
                'DATABASE_URL environment variable is missing for the PostgreSQL session store',
            )
        })

        it('throws if SESSION_SECRET is missing in deployed environments', () => {
            expect(() =>
                createSessionOptions({
                    nodeEnv: 'production',
                    databaseUrl: 'postgresql://user:pass@localhost:5432/db',
                }),
            ).toThrow('SESSION_SECRET environment variable is missing')
        })
    })

    describe('createSessionCookieClearingOptions', () => {
        it('configures clearing options with lax and httpOnly', () => {
            const options = createSessionCookieClearingOptions('production')

            expect(options).toEqual({
                httpOnly: true,
                path: '/',
                sameSite: 'lax',
                secure: true,
            })
        })
    })
})
