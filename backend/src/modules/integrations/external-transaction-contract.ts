import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common'

const MAX_EXTERNAL_ID_BYTES = 200
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{16,128}$/

/** The canonical identity used in ownership, idempotency, and HTTP routing. */
export function normalizeExternalTransactionId(value: string): string {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (!normalized || Buffer.byteLength(normalized, 'utf8') > MAX_EXTERNAL_ID_BYTES) {
        throw new BadRequestException('External id must contain between 1 and 200 UTF-8 bytes')
    }
    return normalized
}

/** Parses only the strong ETag format that this API emits. */
export function parseExternalTransactionEtag(value: string | undefined): number {
    if (value === undefined)
        throw new HttpException('If-Match is required', HttpStatus.PRECONDITION_REQUIRED)
    const match = /^"tx-v([1-9]\d*)"$/.exec(value ?? '')
    const version = Number(match?.[1])
    if (!match || !Number.isSafeInteger(version) || version >= 2_147_483_647)
        throw new BadRequestException('If-Match must contain one strong transaction ETag')
    return version
}

export function normalizeIdempotencyKey(value: string): string {
    if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value.trim()))
        throw new BadRequestException(
            'Idempotency-Key must contain 16 to 128 visible ASCII characters',
        )
    return value.trim()
}
