import { validateEmailInput, validateMoneyAmountValue, validatePassword } from './validation'

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

describe('validateEmailInput', () => {
    it('rejects adversarial repeated input in linear time without regex backtracking', () => {
        const errors: string[] = []
        const result = validateEmailInput({
            email: '!@!.' + '!.'.repeat(100_000),
        })

        errors.push(...result.errors)
        expect(result.email).toBeDefined()
        expect(errors).toEqual(['Email must be a valid email address'])
    })

    it('accepts a normal email address', () => {
        expect(validateEmailInput({ email: ' Ada@example.com ' })).toEqual({
            email: 'ada@example.com',
            errors: [],
        })
    })
})

describe('validatePassword', () => {
    it('accepts a 15-character passphrase without composition rules', () => {
        expect(validatePassword('kot śpi na kanapie')).toEqual([])
        expect(validatePassword('my password is a long phrase')).toEqual([])
    })

    it('rejects short passwords and exact common passwords', () => {
        expect(validatePassword('a'.repeat(14))).toContain(
            'Password must be at least 15 characters long',
        )
        expect(validatePassword('PASSWORDPASSWORD')).toContain(
            'Password is too common. Choose a less predictable password',
        )
        expect(validatePassword('😀'.repeat(14))).toContain(
            'Password must be at least 15 characters long',
        )
    })
})
