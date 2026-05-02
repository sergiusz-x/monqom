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

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: appLogger,
    })

    app.use(helmet())
    app.use(compression())

    const configService = app.get(ConfigService)
    const nodeEnv = configService.get<string>('env.nodeEnv', 'development')
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
                databaseUrl: configService.get<string>('env.databaseUrl'),
                sessionSecret: process.env.SESSION_SECRET,
            }),
        ),
    )

    // Apply observability middlewares globally
    app.use(requestIdMiddleware)
    app.use(requestLoggerMiddleware)

    app.setGlobalPrefix('api/v1', {
        exclude: ['health', 'ready'],
    })

    app.useGlobalFilters(new AllExceptionsFilter())

    const port = configService.get<number>('env.port', 3000)

    await app.listen(port)
}
bootstrap()
