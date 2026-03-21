import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import compression from 'compression'
import { requestIdMiddleware } from './shared/middleware/requestId'
import { requestLoggerMiddleware } from './shared/middleware/requestLogger'
import { AllExceptionsFilter } from './shared/filters/http-exception.filter'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    app.use(helmet())
    app.use(compression())
    app.enableCors()
    
    // Apply observability middlewares globally
    app.use(requestIdMiddleware)
    app.use(requestLoggerMiddleware)

    app.setGlobalPrefix('api/v1', {
        exclude: ['health', 'ready'],
    })

    app.useGlobalFilters(new AllExceptionsFilter())

    const configService = app.get(ConfigService)
    const port = configService.get<number>('env.port', 3000)

    await app.listen(port)
}
bootstrap()
