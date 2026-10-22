import { DocumentBuilder } from '@nestjs/swagger'
import { SESSION_COOKIE_NAME } from '../session/session.config'

export function createOpenApiConfiguration() {
    return new DocumentBuilder()
        .setTitle('Monqom API')
        .setDescription('The Monqom API description')
        .setVersion('1.0')
        .addServer('/api/v1')
        .addCookieAuth(SESSION_COOKIE_NAME, { type: 'apiKey', in: 'cookie' }, SESSION_COOKIE_NAME)
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                description:
                    'Workspace-bound opaque integration credential. Each machine endpoint requires its exact independent scope.',
            },
            'integrationCredential',
        )
        .addTag('monqom')
        .build()
}
