import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'

export interface CorsConfigurationInput {
    nodeEnv: string
    allowedOrigins: string[]
}

export function createCorsOptions(input: CorsConfigurationInput): CorsOptions {
    const allowedOrigins = normalizeAllowedOrigins(input.allowedOrigins)
    const shouldRequireAllowlist = input.nodeEnv === 'production'

    if (shouldRequireAllowlist && allowedOrigins.length === 0) {
        throw new Error('CORS_ALLOWED_ORIGINS environment variable is missing in production')
    }

    return {
        credentials: true,
        origin: (requestOrigin, callback) => {
            if (!requestOrigin) {
                callback(null, true)
                return
            }

            if (allowedOrigins.includes(requestOrigin)) {
                callback(null, true)
                return
            }

            if (!shouldRequireAllowlist && allowedOrigins.length === 0) {
                callback(null, true)
                return
            }

            callback(new Error('Origin not allowed by CORS'))
        },
    }
}

function normalizeAllowedOrigins(origins: string[]): string[] {
    return origins.map((origin) => origin.trim()).filter((origin) => origin.length > 0)
}
