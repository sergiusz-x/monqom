import { createHmac } from 'crypto'

export function createOpaqueDigest(value: string, context: string, secret: string): string {
    if (!secret) throw new Error('A server secret is required to create an opaque digest')

    return createHmac('sha256', secret)
        .update(context, 'utf8')
        .update('\0', 'utf8')
        .update(value, 'utf8')
        .digest('hex')
}
