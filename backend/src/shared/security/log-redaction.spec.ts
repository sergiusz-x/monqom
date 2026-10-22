/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    isMachineApiRequest,
    redactSensitiveText,
    redactSensitiveValue,
    safeRequestLogPath,
} from './log-redaction'
import { logger } from '../utils/logger'

describe('sensitive log redaction', () => {
    const secret = 'mqic_abcdefghijkl.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12'

    it('removes credentials, bearer values, idempotency keys, and URL query strings', () => {
        expect(redactSensitiveText(`Authorization: Bearer ${secret}`)).not.toContain(secret)
        expect(
            redactSensitiveText(`{"token":"${secret}","idempotency-key":"private-key"}`),
        ).not.toContain(secret)
        expect(redactSensitiveText('https://example.test/api?token=secret&x=1')).toBe(
            'https://example.test/api',
        )
    })

    it('redacts nested fields while preserving nonsecret lookup prefixes and safely handles cycles', () => {
        const item: any = {
            token: secret,
            token_prefix: 'mqic_abcdefghijkl',
            password: 'secret',
            name: 'Importer',
        }
        item.self = item
        const redacted: any = redactSensitiveValue(item)
        expect(redacted.token).toBe('[REDACTED]')
        expect(redacted.password).toBe('[REDACTED]')
        expect(redacted.token_prefix).toBe('[REDACTED]')
        expect(redacted.name).toBe('Importer')
        expect(redacted.self).toBe('[Circular]')
    })

    it('omits queries and masks secret-like request paths', () => {
        expect(safeRequestLogPath({ originalUrl: `/api/v1/auth?token=${secret}` } as any)).toBe(
            '/api/v1/auth',
        )
        expect(safeRequestLogPath({ originalUrl: `/api/${secret}` } as any)).toBe('/api/[REDACTED]')
        expect(
            isMachineApiRequest({
                originalUrl: '/api/v1/workspaces/a/external-transactions?token=x',
            } as any),
        ).toBe(true)
    })

    it('redacts secrets through the configured Winston format pipeline', () => {
        const formatted = logger.format.transform(
            {
                level: 'info',
                message: `POST /api/v1/workspaces/demo/external-transactions?token=${secret} Bearer ${secret}`,
                authorization: `Bearer ${secret}`,
                idempotency_key: 'private-idempotency-value',
                details: { token: secret },
                request_uri: `https://example.test/path?access_token=${secret}`,
            },
            logger.format.options,
        ) as any
        const output = String(formatted?.[Symbol.for('message')] ?? '')

        expect(output).not.toContain(secret)
        expect(output).not.toContain('private-idempotency-value')
        expect(output).not.toContain('access_token=')
        expect(output).toContain('[REDACTED]')
    })
})
