import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import compression from 'compression'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    app.use(helmet())
    app.use(compression())
    app.enableCors()

    app.setGlobalPrefix('api/v1', {
        exclude: ['health', 'ready'],
    })

    const configService = app.get(ConfigService)
    const port = configService.get<number>('env.port', 3000)

    await app.listen(port)
}
bootstrap()
