import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'

interface TurnstileResponse {
    success: boolean
}

export async function verifyTurnstileToken(input: {
    token?: string
    remoteIp?: string
}): Promise<void> {
    if (process.env.TURNSTILE_ENABLED !== 'true') return
    if (!input.token)
        throw new BadRequestException({
            code: 'TURNSTILE_REQUIRED',
            message: 'Security verification is required',
        })
    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) throw new ServiceUnavailableException('Security verification is unavailable')
    let response: Response
    try {
        response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret,
                response: input.token,
                ...(input.remoteIp ? { remoteip: input.remoteIp } : {}),
            }),
            signal: AbortSignal.timeout(5000),
        })
    } catch {
        throw new ServiceUnavailableException('Security verification is unavailable')
    }
    const result = (await response.json()) as TurnstileResponse
    if (!response.ok || !result.success)
        throw new BadRequestException({
            code: 'TURNSTILE_INVALID',
            message: 'Security verification failed',
        })
}
