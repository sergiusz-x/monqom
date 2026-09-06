import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import {
    normalizeExternalTransactionId,
    parseExternalTransactionEtag,
} from './external-transaction-contract'

describe('external transaction contract', () => {
    it('uses one canonical external id normalization at every boundary', () => {
        expect(normalizeExternalTransactionId('  bank-entry-1  ')).toBe('bank-entry-1')
        expect(() => normalizeExternalTransactionId('')).toThrow(BadRequestException)
        expect(() => normalizeExternalTransactionId('ż'.repeat(101))).toThrow(BadRequestException)
    })

    it('accepts only strong ETags emitted by the lifecycle API', () => {
        expect(parseExternalTransactionEtag('"tx-v42"')).toBe(42)
        try {
            parseExternalTransactionEtag('W/"tx-v42"')
            fail('Expected an HTTP exception')
        } catch (error) {
            expect(error).toBeInstanceOf(HttpException)
            expect((error as HttpException).getStatus()).toBe(HttpStatus.PRECONDITION_REQUIRED)
        }
    })
})
