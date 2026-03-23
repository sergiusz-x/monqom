const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    email?: unknown
    name?: unknown
    password?: unknown
}

export interface EmailValidationInput {
    email?: unknown
}

export interface LoginValidationInput {
    email?: unknown
    password?: unknown
}

export interface VerificationTokenValidationInput {
    token?: unknown
}

export interface ResetPasswordValidationInput {
    token?: unknown
    newPassword?: unknown
}

export interface CurrentPasswordValidationInput {
    currentPassword?: unknown
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
    if (typeof input.password !== 'string' || input.password.length === 0) {
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
    if (typeof input.token !== 'string' || input.token.trim().length === 0) {
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
    if (typeof input.newPassword !== 'string' || input.newPassword.length === 0) {
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
    if (typeof input.currentPassword !== 'string' || input.currentPassword.length === 0) {
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
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
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
    if (typeof input.password !== 'string' || input.password.length === 0) {
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

function validateEmailValue(input: unknown, errors: string[]): string | undefined {
    if (typeof input !== 'string' || input.trim().length === 0) {
        errors.push('Email is required')
        return undefined
    }

    const email = normalizeEmail(input)

    if (!EMAIL_REGEX.test(email)) {
        errors.push('Email must be a valid email address')
    }

    return email
}
