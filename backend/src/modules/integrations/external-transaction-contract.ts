import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common'

const MAX_EXTERNAL_ID_BYTES = 200

/** The canonical identity used in ownership, idempotency, and HTTP routing. */
export function normalizeExternalTransactionId(value: string): string {
    const normalized = value?.trim()
    if (!normalized || Buffer.byteLength(normalized, 'utf8') > MAX_EXTERNAL_ID_BYTES) {
        throw new BadRequestException('External id must contain between 1 and 200 UTF-8 bytes')
    }
    return normalized
}

/** Parses only the strong ETag format that this API emits. */
export function parseExternalTransactionEtag(value: string | undefined): number {
    const match = /^"tx-v([1-9]\d*)"$/.exec(value ?? '')
    if (!match) throw new HttpException('If-Match is required', HttpStatus.PRECONDITION_REQUIRED)
    return Number(match[1])
}
