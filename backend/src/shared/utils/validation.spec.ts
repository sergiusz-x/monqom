import {
    validateEmailInput,
    validateLoginInput,
    validatePassword,
    validateRegistrationInput,
    validateVerificationTokenInput,
} from './validation'

describe('validation utils', () => {
    it('normalizes valid registration input', () => {
        const result = validateRegistrationInput({
            email: '  USER@Example.com ',
            name: '  Ada Lovelace ',
            password: 'GraniteHarbor!1234',
        })

        expect(result).toEqual({
            email: 'user@example.com',
            name: 'Ada Lovelace',
            password: 'GraniteHarbor!1234',
            errors: [],
        })
    })

    it('returns clear validation errors for invalid registration input', () => {
        const result = validateRegistrationInput({
            email: 'invalid-email',
            name: ' ',
            password: 'weak',
        })

        expect(result.errors).toEqual(
            expect.arrayContaining([
                'Email must be a valid email address',
                'Name is required',
                'Password must be at least 16 characters long',
                'Password must contain at least one uppercase letter',
                'Password must contain at least one number',
                'Password must contain at least one special character',
            ]),
        )
    })

    it('rejects commonly used passwords that otherwise meet complexity rules', () => {
        expect(validatePassword('PasswordPassword1!')).toContain(
            'Password is too common. Choose a less predictable password',
        )
    })

    it('normalizes standalone email input for auth flows', () => {
        expect(validateEmailInput({ email: '  USER@Example.com ' })).toEqual({
            email: 'user@example.com',
            errors: [],
        })
    })

    it('normalizes login input and keeps the password untouched', () => {
        expect(
            validateLoginInput({
                email: '  USER@Example.com ',
                password: '  GraniteHarbor!1234  ',
            }),
        ).toEqual({
            email: 'user@example.com',
            password: '  GraniteHarbor!1234  ',
            errors: [],
        })
    })

    it('returns clear validation errors for invalid login input', () => {
        expect(
            validateLoginInput({
                email: 'invalid-email',
                password: '',
            }),
        ).toEqual({
            email: 'invalid-email',
            password: undefined,
            errors: ['Email must be a valid email address', 'Password is required'],
        })
    })

    it('requires a verification token when verifying email', () => {
        expect(validateVerificationTokenInput({ token: '   ' })).toEqual({
            token: undefined,
            errors: ['Token is required'],
        })
    })

    it('trims verification tokens from email links or form input', () => {
        expect(validateVerificationTokenInput({ token: '  abc123  ' })).toEqual({
            token: 'abc123',
            errors: [],
        })
    })
})
