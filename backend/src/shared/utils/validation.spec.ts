import { validateMoneyAmountValue } from './validation'

describe('validateMoneyAmountValue', () => {
    it('converts decimal input to integer minor units without floating-point multiplication', () => {
        const errors: string[] = []

        expect(validateMoneyAmountValue(0.29, errors)).toBe(29)
        expect(validateMoneyAmountValue('16.19', errors)).toBe(1619)
        expect(validateMoneyAmountValue('90071992547409.91', errors)).toBe(Number.MAX_SAFE_INTEGER)
        expect(errors).toEqual([])
    })

    it('rejects fractions smaller than one minor unit', () => {
        const errors: string[] = []

        expect(validateMoneyAmountValue(1.005, errors)).toBeUndefined()
        expect(errors).toEqual(['Amount must be a positive number with up to 2 decimal places'])
    })
})
