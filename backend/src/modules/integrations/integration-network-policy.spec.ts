import { BadRequestException } from '@nestjs/common'
import {
    isIntegrationIpAllowed,
    isIntegrationLoopback,
    normalizeIntegrationCidrs,
    normalizeIntegrationClientIp,
} from './integration-network-policy'

describe('integration network policy', () => {
    it('canonicalizes IPv4/IPv6 and mapped loopback addresses', () => {
        expect(normalizeIntegrationClientIp('192.0.2.1')).toBe('192.0.2.1')
        expect(normalizeIntegrationClientIp('::ffff:192.0.2.1')).toBe('192.0.2.1')
        expect(normalizeIntegrationClientIp('2001:db8::1')).toBe('2001:db8:0:0:0:0:0:1')
        expect(isIntegrationLoopback('::ffff:127.0.0.1')).toBe(true)
        expect(normalizeIntegrationClientIp('fe80::1%eth0')).toBeUndefined()
    })

    it('normalizes CIDRs, host bits, duplicates, and IPv4-mapped IPv6 policies', () => {
        expect(normalizeIntegrationCidrs(['192.0.2.99/24', '192.0.2.0/24'])).toEqual([
            '192.0.2.0/24',
        ])
        expect(normalizeIntegrationCidrs(['2001:db8::abcd/64'])).toEqual([
            '2001:db8:0:0:0:0:0:0/64',
        ])
        expect(normalizeIntegrationCidrs(['::ffff:192.0.2.1/120'])).toEqual(['192.0.2.0/24'])
        expect(normalizeIntegrationCidrs(['::/0'])).toEqual(['0:0:0:0:0:0:0:0/0'])
    })

    it.each([
        '192.0.2.1',
        '192.0.2.1/33',
        '2001:db8::1/129',
        '192.0.2.1/024',
        '::1/-1',
        'fe80::1%eth0/64',
    ])('rejects invalid CIDR %s', (value) => {
        expect(() => normalizeIntegrationCidrs([value])).toThrow(BadRequestException)
    })

    it('distinguishes unrestricted, empty, and allowlisted networks', () => {
        expect(isIntegrationIpAllowed(undefined, [], false)).toBe(true)
        expect(isIntegrationIpAllowed('192.0.2.1', [], true)).toBe(false)
        expect(isIntegrationIpAllowed('192.0.2.1', ['192.0.2.0/24'], true)).toBe(true)
        expect(isIntegrationIpAllowed('192.0.2.1', ['198.51.100.0/24'], true)).toBe(false)
        expect(isIntegrationIpAllowed('::ffff:192.0.2.1', ['192.0.2.0/24'], true)).toBe(true)
        expect(isIntegrationIpAllowed('192.0.2.1', ['0:0:0:0:0:0:0:0/0'], true)).toBe(true)
        expect(isIntegrationIpAllowed('192.0.2.1', ['192.0.2.1/32'], true)).toBe(true)
        expect(isIntegrationIpAllowed('192.0.2.2', ['192.0.2.1/32'], true)).toBe(false)
        expect(isIntegrationIpAllowed('2001:db8::1', ['2001:db8::1/128'], true)).toBe(true)
        expect(isIntegrationIpAllowed('2001:db8::2', ['2001:db8::1/128'], true)).toBe(false)
    })
})
