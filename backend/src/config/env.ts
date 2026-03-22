import { registerAs } from '@nestjs/config'

export default registerAs('env', () => {
    const env = {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseUrl: process.env.DATABASE_URL,
        corsAllowedOrigins: parseCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
    }

    // Simplistic MVP validation mechanism
    if (!env.databaseUrl && env.nodeEnv !== 'test') {
        throw new Error('DATABASE_URL environment variable is missing')
    }

    return env
})

function parseCorsAllowedOrigins(input?: string): string[] {
    if (!input) {
        return []
    }

    return input
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
}
