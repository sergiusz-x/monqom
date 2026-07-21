import { logger } from '../utils/logger'

export async function sendTransactionalEmail(input: {
    to: string
    subject: string
    html: string
}): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
        logger.info('Transactional email suppressed outside production', {
            context_name: 'EmailDelivery',
            recipient_domain: input.to.split('@')[1] ?? 'invalid',
            subject: input.subject,
        })
        return
    }
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    // Production boot validation prevents this branch in a real deployment.
    // Keeping it non-throwing makes isolated service tests and maintenance commands safe.
    if (!apiKey || !from) return
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
        signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
        logger.error('Transactional email provider rejected delivery', {
            context_name: 'EmailDelivery',
            status_code: response.status,
        })
        throw new Error('Email delivery is unavailable')
    }
}
