import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16
const TOTP_ENCRYPTION_KEY_ENV = 'TOTP_ENCRYPTION_KEY'

export function encryptSensitiveValue(value: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES)
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptSensitiveValue(payload: string): string {
    const decodedPayload = Buffer.from(payload, 'base64')

    if (decodedPayload.length <= IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
        throw new Error('Encrypted payload is invalid')
    }

    const iv = decodedPayload.subarray(0, IV_LENGTH_BYTES)
    const authTag = decodedPayload.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES)
    const encrypted = decodedPayload.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES)
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv)

    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function getEncryptionKey(): Buffer {
    const encryptionSecret = process.env[TOTP_ENCRYPTION_KEY_ENV]

    if (!encryptionSecret || encryptionSecret.trim().length === 0) {
        throw new Error(`${TOTP_ENCRYPTION_KEY_ENV} environment variable is missing`)
    }

    return createHash('sha256').update(encryptionSecret, 'utf8').digest()
}
