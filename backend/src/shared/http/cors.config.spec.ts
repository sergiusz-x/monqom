import { createCorsOptions } from './cors.config'

describe('createCorsOptions', () => {
    it('allows configured origins and enables credentials', async () => {
        const options = createCorsOptions({
            nodeEnv: 'production',
            allowedOrigins: ['https://app.monqom.test'],
        })

        await expect(runOriginCheck(options, 'https://app.monqom.test')).resolves.toBe(true)
        expect(options.credentials).toBe(true)
    })

    it('rejects unknown origins when an allowlist is configured', async () => {
        const options = createCorsOptions({
            nodeEnv: 'production',
            allowedOrigins: ['https://app.monqom.test'],
        })

        await expect(runOriginCheck(options, 'https://evil.example')).rejects.toThrow(
            'Origin not allowed by CORS',
        )
    })

    it('allows requests without an Origin header', async () => {
        const options = createCorsOptions({
            nodeEnv: 'production',
            allowedOrigins: ['https://app.monqom.test'],
        })

        await expect(runOriginCheck(options, undefined)).resolves.toBe(true)
    })

    it('allows any origin outside production when no allowlist is configured', async () => {
        const options = createCorsOptions({
            nodeEnv: 'development',
            allowedOrigins: [],
        })

        await expect(runOriginCheck(options, 'http://localhost:5173')).resolves.toBe(true)
    })

    it('requires an explicit allowlist in production', () => {
        expect(() =>
            createCorsOptions({
                nodeEnv: 'production',
                allowedOrigins: [],
            }),
        ).toThrow('CORS_ALLOWED_ORIGINS environment variable is missing in production')
    })
})

function runOriginCheck(
    options: ReturnType<typeof createCorsOptions>,
    origin: string | undefined,
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const { origin: originHandler } = options

        if (typeof originHandler !== 'function') {
            reject(new Error('Expected CORS origin handler to be a function'))
            return
        }

        originHandler(origin, (error, allowed) => {
            if (error) {
                reject(error)
                return
            }

            resolve(allowed === true)
        })
    })
}
