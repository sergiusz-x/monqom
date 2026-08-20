import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RuntimeConfig } from '../../config/env'
import { logger } from '../utils/logger'

@Injectable()
export class EmailDeliveryService {
    constructor(private readonly configService: ConfigService) {}

    async send(input: {
        to: string
        subject: string
        html: string
        idempotencyKey: string
    }): Promise<void> {
        const config = this.configService.get<RuntimeConfig>('env', { infer: true })
        if (!config || config.nodeEnv !== 'production') {
            logger.info('Transactional email suppressed outside production', {
                context_name: EmailDeliveryService.name,
                recipient_domain: input.to.split('@')[1] ?? 'invalid',
                subject: input.subject,
            })
            return
        }
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.resendApiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': input.idempotencyKey,
            },
            body: JSON.stringify({
                from: config.emailFrom,
                to: [input.to],
                subject: input.subject,
                html: input.html,
            }),
            signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) throw new Error(`Email provider returned ${response.status}`)
    }
}
