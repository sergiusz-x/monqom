import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import compression from 'compression'
import session from 'express-session'
import { requestIdMiddleware } from './shared/middleware/requestId'
import { requestLoggerMiddleware } from './shared/middleware/requestLogger'
import { AllExceptionsFilter } from './shared/filters/http-exception.filter'
import { appLogger } from './shared/utils/logger'
import { createSessionOptions } from './shared/session/session.config'
import { createCorsOptions } from './shared/http/cors.config'
import { csrfProtectionMiddleware } from './shared/security/csrf'
import { createRequestValidationPipe } from './shared/validation/request-validation.pipe'
import type { RuntimeConfig } from './config/env'

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: appLogger,
    })

    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
    app.use(compression())

    const configService = app.get(ConfigService)
    const runtimeConfig = configService.get<RuntimeConfig>('env')
    if (!runtimeConfig) throw new Error('Runtime configuration is unavailable')
    const nodeEnv = runtimeConfig.nodeEnv
    const corsAllowedOrigins = configService.get<string[]>('env.corsAllowedOrigins', [])

    app.enableCors(
        createCorsOptions({
            nodeEnv,
            allowedOrigins: corsAllowedOrigins,
        }),
    )

    if (nodeEnv === 'production' || nodeEnv === 'staging') {
        app.set('trust proxy', 1)
    }

    app.use(
        session(
            createSessionOptions({
                nodeEnv,
                databaseUrl: runtimeConfig.databaseUrl,
                sessionSecret: runtimeConfig.sessionSecret,
            }),
        ),
    )
    app.use(csrfProtectionMiddleware)

    // Apply observability middlewares globally
    app.use(requestIdMiddleware)
    app.use(requestLoggerMiddleware)

    app.setGlobalPrefix('api/v1', {
        exclude: ['health', 'ready'],
    })

    app.useGlobalPipes(createRequestValidationPipe())

    app.useGlobalFilters(new AllExceptionsFilter())

    const port = runtimeConfig.port

    app.enableShutdownHooks()
    await app.listen(port, '0.0.0.0')
}
bootstrap()
