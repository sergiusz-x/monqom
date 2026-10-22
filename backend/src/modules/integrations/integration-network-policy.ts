import { BadRequestException } from '@nestjs/common'
import { isIP } from 'net'

interface Address {
    family: 4 | 6
    value: bigint
}

function parseAddress(input: string): Address | null {
    if (input.includes('%')) return null
    const family = isIP(input)
    if (family === 4) {
        return {
            family,
            value: input.split('.').reduce((value, part) => (value << 8n) | BigInt(part), 0n),
        }
    }
    if (family !== 6) return null
    let address = input.toLowerCase()
    // IPv6 may end in a dotted IPv4 address, not just hexadecimal groups.
    if (address.includes('.')) {
        const separator = address.lastIndexOf(':')
        const tail = parseAddress(address.slice(separator + 1))
        if (!tail || tail.family !== 4) return null
        address = `${address.slice(0, separator)}:${(tail.value >> 16n).toString(16)}:${(tail.value & 65535n).toString(16)}`
    }
    const [head = '', tail = ''] = address.split('::')
    const headParts = head ? head.split(':') : []
    const tailParts = tail ? tail.split(':') : []
    const parts = address.includes('::')
        ? [...headParts, ...Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts]
        : headParts
    const value = parts.reduce<bigint>((result, part) => (result << 16n) | BigInt(`0x${part}`), 0n)
    return { family: 6, value }
}

function mappedIpv4(address: Address): Address {
    return address.family === 6 && address.value >> 32n === 65535n
        ? { family: 4, value: address.value & 0xffffffffn }
        : address
}

function formatAddress({ family, value }: Address): string {
    if (family === 4) {
        return [24n, 16n, 8n, 0n].map((shift) => String((value >> shift) & 255n)).join('.')
    }
    return [112n, 96n, 80n, 64n, 48n, 32n, 16n, 0n]
        .map((shift) => ((value >> shift) & 65535n).toString(16))
        .join(':')
}

export function normalizeIntegrationClientIp(input: string | undefined): string | undefined {
    if (!input) return undefined
    const address = parseAddress(input)
    return address ? formatAddress(mappedIpv4(address)) : undefined
}

function parseCidr(input: string): (Address & { prefix: number }) | null {
    const match = /^([^/]+)\/(0|[1-9][0-9]{0,2})$/.exec(input)
    if (!match) return null
    let address = parseAddress(match[1]!)
    let prefix = Number(match[2])
    if (!address || prefix > (address.family === 4 ? 32 : 128)) return null
    const normalized = mappedIpv4(address)
    if (address.family === 6 && normalized.family === 4) {
        // Broader IPv6 networks retain their IPv6 meaning.
        if (prefix >= 96) {
            address = normalized
            prefix -= 96
        }
    }
    const bits = address.family === 4 ? 32 : 128
    const shift = BigInt(bits - prefix)
    return { ...address, value: (address.value >> shift) << shift, prefix }
}

export function normalizeIntegrationCidrs(cidrs: readonly string[]): string[] {
    return [
        ...new Set(
            cidrs.map((value) => {
                const cidr = parseCidr(value.trim())
                if (!cidr) throw new BadRequestException('Credential CIDR restriction is invalid')
                return `${formatAddress(cidr)}/${cidr.prefix}`
            }),
        ),
    ]
}

export function isIntegrationIpAllowed(
    clientIp: string | undefined,
    allowedCidrs: readonly string[],
    enabled: boolean,
): boolean {
    if (!enabled) return true
    const input = clientIp ? parseAddress(clientIp) : null
    if (!input) return false
    const client = mappedIpv4(input)
    return allowedCidrs.some((value) => {
        const network = parseCidr(value)
        if (!network) return false
        // Also match a normalized IPv4 client against broad IPv6 networks containing mapped IPv4.
        const comparable =
            network.family === 6 && client.family === 4
                ? { family: 6 as const, value: (65535n << 32n) | client.value }
                : client
        if (comparable.family !== network.family) return false
        const shift = BigInt((network.family === 4 ? 32 : 128) - network.prefix)
        return comparable.value >> shift === network.value >> shift
    })
}

export function isIntegrationLoopback(input: string | undefined): boolean {
    const ip = normalizeIntegrationClientIp(input)
    return ip !== undefined && (ip.startsWith('127.') || ip === '0:0:0:0:0:0:0:1')
}
