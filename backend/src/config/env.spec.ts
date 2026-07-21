import envConfig from './env'

const productionEnvironment = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://monqom:secret@database:5432/monqom',
    SESSION_SECRET: 'a'.repeat(32),
    TOTP_ENCRYPTION_KEY: 'b'.repeat(32),
    FRONTEND_URL: 'https://app.example.test',
    CORS_ALLOWED_ORIGINS: 'https://app.example.test',
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'Monqom <noreply@example.test>',
    TURNSTILE_ENABLED: 'true',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
}

describe('production environment configuration', () => {
    const originalEnvironment = process.env

    beforeEach(() => {
        process.env = { ...productionEnvironment }
    })

    afterAll(() => {
        process.env = originalEnvironment
    })

    it('accepts a complete production configuration', () => {
        const config = envConfig()

        expect(config.nodeEnv).toBe('production')
        expect(config.corsAllowedOrigins).toEqual(['https://app.example.test'])
        expect(config.turnstileEnabled).toBe(true)
    })

    it('rejects a weak session secret', () => {
        process.env.SESSION_SECRET = 'too-short'

        expect(() => envConfig()).toThrow('SESSION_SECRET must contain at least 32 characters')
    })

    it('rejects an HTTP public origin and missing Turnstile secret', () => {
        process.env.FRONTEND_URL = 'http://app.example.test'
        process.env.CORS_ALLOWED_ORIGINS = 'http://app.example.test'

        expect(() => envConfig()).toThrow('FRONTEND_URL must be an HTTPS URL')

        process.env.FRONTEND_URL = 'https://app.example.test'
        process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.test'
        delete process.env.TURNSTILE_SECRET_KEY

        expect(() => envConfig()).toThrow('TURNSTILE_SECRET_KEY is required')
    })
})
