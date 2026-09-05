const UNIQUE_CONSTRAINT_VIOLATION_CODE = 'P2002'

export function isPrismaUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === UNIQUE_CONSTRAINT_VIOLATION_CODE
    )
}
