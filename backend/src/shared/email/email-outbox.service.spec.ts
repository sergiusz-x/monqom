import { ConfigService } from '@nestjs/config'
import { EmailOutbox } from '@prisma/client'
import { EmailOutboxService } from './email-outbox.service'

describe('EmailOutboxService', () => {
    const config = {
        get: jest.fn().mockReturnValue({
            emailOutboxEncryptionKey: 'test-email-outbox-encryption-key-32',
            frontendUrl: 'https://app.example.test',
        }),
    } as unknown as ConfigService

    it('stores the recipient and token only inside the encrypted payload', async () => {
        const create = jest.fn().mockResolvedValue(undefined)
        const prisma = { emailOutbox: { create } }
        const service = new EmailOutboxService(prisma as never, {} as never, config)

        await service.enqueue('verification', 'User@Example.test', 'raw-secret-token')

        const data = create.mock.calls[0][0].data
        expect(data.recipient).toMatch(/^[a-f0-9]{64}$/)
        expect(data.recipient).not.toContain('User@Example.test')
        expect(data.encryptedPayload).not.toContain('User@Example.test')
        expect(data.encryptedPayload).not.toContain('raw-secret-token')
    })

    it('delivers a claimed message with a stable idempotency key and clears the payload', async () => {
        const create = jest.fn().mockResolvedValue(undefined)
        const update = jest.fn().mockResolvedValue(undefined)
        const transaction = jest.fn().mockResolvedValue(undefined)
        const queryRaw = jest.fn()
        const prisma = {
            emailOutbox: { create, update },
            emailVerificationToken: { deleteMany: jest.fn() },
            passwordResetToken: { deleteMany: jest.fn() },
            $transaction: transaction,
            $queryRaw: queryRaw,
        }
        const delivery = { send: jest.fn().mockResolvedValue(undefined) }
        const service = new EmailOutboxService(prisma as never, delivery as never, config)
        await service.enqueue('password_reset', 'user@example.test', 'reset-token')
        const encryptedPayload = create.mock.calls[0][0].data.encryptedPayload as string
        const row = {
            id: '0f73eeeb-1eb8-4c37-a35a-02f40d634d2f',
            kind: 'password_reset',
            recipient: create.mock.calls[0][0].data.recipient,
            encryptedPayload,
            status: 'processing',
            attempts: 0,
            availableAt: new Date(),
            lockedAt: new Date(),
            sentAt: null,
            lastError: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        } satisfies EmailOutbox
        queryRaw.mockResolvedValue([row])

        await service.processBatch()

        expect(delivery.send).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'user@example.test',
                idempotencyKey: `email-outbox/${row.id}`,
            }),
        )
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: row.id },
                data: expect.objectContaining({ status: 'sent', encryptedPayload: '' }),
            }),
        )
    })
})
