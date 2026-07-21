const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MONEY_AMOUNT_REGEX = /^\d+(?:\.\d{1,2})?$/

const COMMON_PASSWORD_PATTERNS = [
    'password',
    'qwerty',
    'letmein',
    'welcome',
    'admin',
    'monkey',
    'football',
    'abc123',
    'iloveyou',
] as const

export interface RegistrationValidationInput {
    email: string
    name: string
    password: string
}

export interface EmailValidationInput {
    email: string
}

export interface LoginValidationInput {
    email: string
    password: string
}

export interface VerificationTokenValidationInput {
    token: string
}

export interface ResetPasswordValidationInput {
    token: string
    newPassword: string
}

export interface CurrentPasswordValidationInput {
    currentPassword: string
}

export interface RegistrationValidationResult {
    email?: string
    name?: string
    password?: string
    errors: string[]
}

export interface EmailValidationResult {
    email?: string
    errors: string[]
}

export interface LoginValidationResult {
    email?: string
    password?: string
    errors: string[]
}

export interface VerificationTokenValidationResult {
    token?: string
    errors: string[]
}

export interface ResetPasswordValidationResult {
    token?: string
    newPassword?: string
    errors: string[]
}

export interface CurrentPasswordValidationResult {
    currentPassword?: string
    errors: string[]
}

export interface MoneyAmountValidationOptions {
    maxAmountCents?: number
    maxAmountMessage?: string
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

export function validatePassword(password: string): string[] {
    const errors: string[] = []
    const normalizedPassword = password.toLowerCase().replace(/[^a-z0-9]/g, '')

    if (password.length < 16) {
        errors.push('Password must be at least 16 characters long')
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter')
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number')
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character')
    }

    if (COMMON_PASSWORD_PATTERNS.some((pattern) => normalizedPassword.includes(pattern))) {
        errors.push('Password is too common. Choose a less predictable password')
    }

    return errors
}

export function validateEmailInput(input: EmailValidationInput): EmailValidationResult {
    const errors: string[] = []

    return {
        email: validateEmailValue(input.email, errors),
        errors,
    }
}

export function validateLoginInput(input: LoginValidationInput): LoginValidationResult {
    const errors: string[] = []
    const email = validateEmailValue(input.email, errors)

    let password: string | undefined
    if (input.password.length === 0) {
        errors.push('Password is required')
    } else {
        password = input.password
    }

    return {
        email,
        password,
        errors,
    }
}

export function validateVerificationTokenInput(
    input: VerificationTokenValidationInput,
): VerificationTokenValidationResult {
    const errors: string[] = []

    let token: string | undefined
    if (input.token.trim().length === 0) {
        errors.push('Token is required')
    } else {
        token = input.token.trim()
    }

    return {
        token,
        errors,
    }
}

export function validateResetPasswordInput(
    input: ResetPasswordValidationInput,
): ResetPasswordValidationResult {
    const { token, errors } = validateVerificationTokenInput(input)

    let newPassword: string | undefined
    if (input.newPassword.length === 0) {
        errors.push('New password is required')
    } else {
        newPassword = input.newPassword
        errors.push(...validatePassword(newPassword))
    }

    return {
        token,
        newPassword,
        errors,
    }
}

export function validateCurrentPasswordInput(
    input: CurrentPasswordValidationInput,
): CurrentPasswordValidationResult {
    const errors: string[] = []

    let currentPassword: string | undefined
    if (input.currentPassword.length === 0) {
        errors.push('Current password is required')
    } else {
        currentPassword = input.currentPassword
    }

    return {
        currentPassword,
        errors,
    }
}

export function validateRegistrationInput(
    input: RegistrationValidationInput,
): RegistrationValidationResult {
    const errors: string[] = []

    const email = validateEmailValue(input.email, errors)

    let name: string | undefined
    if (input.name.trim().length === 0) {
        errors.push('Name is required')
    } else {
        name = input.name.trim()
        if (name.length < 2) {
            errors.push('Name must be at least 2 characters long')
        }
        if (name.length > 100) {
            errors.push('Name must be 100 characters or fewer')
        }
    }

    let password: string | undefined
    if (input.password.length === 0) {
        errors.push('Password is required')
    } else {
        password = input.password
        errors.push(...validatePassword(password))
    }

    return {
        email,
        name,
        password,
        errors,
    }
}

export function validateMoneyAmountValue(
    value: unknown,
    errors: string[],
    options: MoneyAmountValidationOptions = {},
): number | undefined {
    if (value === undefined || value === null) {
        errors.push('Amount is required')
        return undefined
    }

    let normalizedValue: string

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            errors.push('Amount must be a valid number')
            return undefined
        }

        normalizedValue = value.toString()
    } else if (typeof value === 'string') {
        normalizedValue = value.trim()

        if (normalizedValue.length === 0) {
            errors.push('Amount is required')
            return undefined
        }
    } else {
        errors.push('Amount must be a positive number with up to 2 decimal places')
        return undefined
    }

    if (!MONEY_AMOUNT_REGEX.test(normalizedValue)) {
        errors.push('Amount must be a positive number with up to 2 decimal places')
        return undefined
    }

    const [wholePart, fractionalPart = ''] = normalizedValue.split('.')
    const amountCents =
        Number.parseInt(wholePart, 10) * 100 +
        Number.parseInt(fractionalPart.padEnd(2, '0') || '0', 10)

    if (!Number.isSafeInteger(amountCents)) {
        errors.push(options.maxAmountMessage ?? 'Amount is too large')
        return undefined
    }

    if (typeof options.maxAmountCents === 'number' && amountCents > options.maxAmountCents) {
        errors.push(options.maxAmountMessage ?? 'Amount is too large')
        return undefined
    }

    if (amountCents <= 0) {
        errors.push('Amount must be greater than 0')
        return undefined
    }

    return amountCents
}

function validateEmailValue(input: string, errors: string[]): string | undefined {
    if (input.trim().length === 0) {
        errors.push('Email is required')
        return undefined
    }

    const email = normalizeEmail(input)

    if (!EMAIL_REGEX.test(email)) {
        errors.push('Email must be a valid email address')
    }

    return email
}
