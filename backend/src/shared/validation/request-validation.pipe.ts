import { ValidationPipe } from '@nestjs/common'

export function createRequestValidationPipe(): ValidationPipe {
    return new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
    })
}
