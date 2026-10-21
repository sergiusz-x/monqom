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
            expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST)
        }
    })

    it('distinguishes missing preconditions from malformed or unsafe versions', () => {
        expect(() => parseExternalTransactionEtag(undefined)).toThrow(HttpException)
        try {
            parseExternalTransactionEtag(undefined)
        } catch (error) {
            expect((error as HttpException).getStatus()).toBe(428)
        }
        for (const value of [
            '',
            '*',
            '"tx-v0"',
            '"tx-v1", "tx-v2"',
            '"tx-v2147483647"',
            '"tx-v9007199254740993"',
        ])
            expect(() => parseExternalTransactionEtag(value)).toThrow(BadRequestException)
    })
})
