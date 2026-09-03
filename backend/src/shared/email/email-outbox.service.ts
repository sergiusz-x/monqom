import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailOutbox, Prisma } from '@prisma/client'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { RuntimeConfig } from '../../config/env'
import { PrismaService } from '../database/prisma.service'
import { logger } from '../utils/logger'
import { EmailDeliveryService } from './resend'

type EmailKind = 'password_reset' | 'verification'
type PersistenceClient = Prisma.TransactionClient | PrismaService
const MAX_AGE_MS = 23 * 60 * 60_000
const MAX_ATTEMPTS = 7

@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
    private timer?: NodeJS.Timeout
    private processing = false
    private lastCleanupAt = 0

    constructor(
        private readonly prisma: PrismaService,
        private readonly delivery: EmailDeliveryService,
        private readonly configService: ConfigService,
    ) {}

    onModuleInit(): void {
        this.timer = setInterval(() => void this.processBatch(), 5_000)
        this.timer.unref()
        void this.processBatch()
    }

    onModuleDestroy(): void {
        if (this.timer) clearInterval(this.timer)
    }

    async enqueue(
        kind: EmailKind,
        recipient: string,
        token: string,
        prisma: PersistenceClient = this.prisma,
    ): Promise<void> {
        await prisma.emailOutbox.create({
            data: {
                kind,
                recipient: createHash('sha256')
                    .update(recipient.trim().toLowerCase())
                    .digest('hex'),
                encryptedPayload: this.encrypt(JSON.stringify({ recipient, token })),
            },
        })
    }

    async processBatch(): Promise<void> {
        if (this.processing) return
        this.processing = true
        try {
            if (Date.now() - this.lastCleanupAt >= 60 * 60_000) {
                await this.cleanupExpiredLegacyTokens()
                this.lastCleanupAt = Date.now()
            }
            const rows = await this.claimBatch()
            await Promise.all(rows.map((row) => this.deliver(row)))
        } catch (error) {
            logger.error('Email outbox processing failed', {
                context_name: EmailOutboxService.name,
                error: error instanceof Error ? error.message : 'unknown',
            })
        } finally {
            this.processing = false
        }
    }

    private async cleanupExpiredLegacyTokens(): Promise<void> {
        const cutoff = new Date(Date.now() - 24 * 60 * 60_000)
        await this.prisma.$transaction([
            this.prisma.emailVerificationToken.deleteMany({
                where: { tokenHash: null, createdAt: { lt: cutoff } },
            }),
            this.prisma.passwordResetToken.deleteMany({
                where: { tokenHash: null, createdAt: { lt: cutoff } },
            }),
        ])
    }

    private claimBatch(): Promise<EmailOutbox[]> {
        const now = new Date()
        const staleBefore = new Date(now.getTime() - 5 * 60_000)
        const oldest = new Date(now.getTime() - MAX_AGE_MS)
        return this.prisma.$queryRaw<EmailOutbox[]>(Prisma.sql`
            UPDATE "email_outbox"
            SET "status" = 'processing', "locked_at" = ${now}, "updated_at" = ${now}
            WHERE "id" IN (
                SELECT "id" FROM "email_outbox"
                WHERE "created_at" >= ${oldest} AND "attempts" < ${MAX_ATTEMPTS} AND "available_at" <= ${now}
                  AND ("status" = 'pending' OR ("status" = 'processing' AND "locked_at" < ${staleBefore}))
                ORDER BY "created_at" FOR UPDATE SKIP LOCKED LIMIT 20
            ) RETURNING
                "id",
                "kind",
                "recipient",
                "encrypted_payload" AS "encryptedPayload",
                "status",
                "attempts",
                "available_at" AS "availableAt",
                "locked_at" AS "lockedAt",
                "sent_at" AS "sentAt",
                "last_error" AS "lastError",
                "created_at" AS "createdAt",
                "updated_at" AS "updatedAt"
        `)
    }

    private async deliver(row: EmailOutbox): Promise<void> {
        try {
            const { recipient, token } = JSON.parse(this.decrypt(row.encryptedPayload)) as {
                recipient: string
                token: string
            }
            await this.delivery.send({
                to: recipient,
                ...buildEmail(row.kind as EmailKind, token, this.frontendUrl()),
                idempotencyKey: `email-outbox/${row.id}`,
            })
            await this.prisma.emailOutbox.update({
                where: { id: row.id },
                data: {
                    status: 'sent',
                    sentAt: new Date(),
                    lockedAt: null,
                    encryptedPayload: '',
                    lastError: null,
                },
            })
        } catch (error) {
            const attempts = row.attempts + 1
            const expired =
                attempts >= MAX_ATTEMPTS || row.createdAt.getTime() < Date.now() - MAX_AGE_MS
            await this.prisma.emailOutbox.update({
                where: { id: row.id },
                data: {
                    status: expired ? 'failed' : 'pending',
                    attempts,
                    availableAt: new Date(Date.now() + retryDelay(attempts)),
                    lockedAt: null,
                    lastError: (error instanceof Error ? error.message : 'unknown').slice(0, 500),
                },
            })
        }
    }

    private encryptionKey(): Buffer {
        const value =
            this.configService.get<RuntimeConfig>('env', { infer: true })
                ?.emailOutboxEncryptionKey ?? 'local-email-outbox-key'
        return createHash('sha256').update(value).digest()
    }

    private frontendUrl(): string {
        return (
            this.configService.get<RuntimeConfig>('env', { infer: true })?.frontendUrl ??
            'http://localhost:5173'
        ).replace(/\/+$/, '')
    }

    private encrypt(value: string): string {
        const iv = randomBytes(12)
        const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv)
        const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
        return [iv, cipher.getAuthTag(), encrypted]
            .map((part) => part.toString('base64url'))
            .join('.')
    }

    private decrypt(value: string): string {
        const parts = value.split('.')
        if (parts.length !== 3) throw new Error('Invalid outbox payload')
        const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'))
        const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv)
        decipher.setAuthTag(tag)
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    }
}

function buildEmail(
    kind: EmailKind,
    token: string,
    frontendUrl: string,
): { subject: string; html: string } {
    const verification = kind === 'verification'
    const url = `${frontendUrl}/${verification ? 'verify-email' : 'reset-password'}?token=${encodeURIComponent(token)}`
    return verification
        ? {
              subject: 'Verify your Monqom email address',
              html: `<p>Verify your email address to activate Monqom.</p><p><a href="${url}">Verify email</a></p>`,
          }
        : {
              subject: 'Reset your Monqom password',
              html: `<p>Use this link to reset your password.</p><p><a href="${url}">Reset password</a></p>`,
          }
}

function retryDelay(attempt: number): number {
    return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1))
}
