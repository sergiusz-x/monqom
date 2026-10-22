/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../../shared/database/prisma.service'
import {
    IntegrationRateLimitExceededError,
    IntegrationRateLimitService,
} from './integration-rate-limit.service'

describe('IntegrationRateLimitService', () => {
    const now = new Date('2026-09-04T10:00:00.000Z')
    function fixture() {
        type State = {
            request_times: Date[]
            mutation_times: Date[]
            blocked_until: Date | null
        }
        const states = new Map<string, State>()
        const tx: any = {
            $executeRaw: jest.fn(async (_query: TemplateStringsArray, keyHash: string) => {
                states.set(
                    keyHash,
                    states.get(keyHash) ?? {
                        request_times: [],
                        mutation_times: [],
                        blocked_until: null,
                    },
                )
                return 1
            }),
            $queryRaw: jest.fn(async (query: TemplateStringsArray, keyHash: string) =>
                query.join('').includes('request_times')
                    ? [{ ...states.get(keyHash)! }]
                    : [{ checked_at: now }],
            ),
            integrationRateLimit: {
                update: jest.fn(async ({ where, data }: any) => {
                    states.set(where.keyHash, {
                        request_times: data.requestTimes,
                        mutation_times: data.mutationTimes,
                        blocked_until: data.blockedUntil,
                    })
                }),
            },
        }
        const prisma: any = {
            $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
            $queryRaw: jest.fn().mockResolvedValue([]),
            integrationRateLimit: { findUnique: jest.fn(), deleteMany: jest.fn() },
        }
        return { service: new IntegrationRateLimitService(prisma as PrismaService), prisma, tx }
    }

    it('enforces 120 requests and 60 mutations inside rolling windows', async () => {
        const { service } = fixture()
        for (let index = 0; index < 60; index++)
            await service.consumeCredential('credential-1', now, true, 'workspace-1')
        await expect(
            service.consumeCredential('credential-1', now, true, 'workspace-1'),
        ).rejects.toBeInstanceOf(IntegrationRateLimitExceededError)
        for (let index = 0; index < 59; index++)
            await service.consumeCredential('credential-1', now, false, 'workspace-1')
        await expect(
            service.consumeCredential('credential-1', now, false, 'workspace-1'),
        ).rejects.toMatchObject({ retryAfterSeconds: 60 })
        await expect(
            service.consumeCredential(
                'credential-1',
                new Date(now.getTime() + 60_001),
                false,
                'workspace-1',
            ),
        ).resolves.toBeUndefined()
    })

    it('isolates limits by both workspace and credential', async () => {
        const { service, tx } = fixture()
        await service.consumeCredential('credential-1', now, true, 'workspace-1')
        await service.consumeCredential('credential-1', now, true, 'workspace-2')
        await service.consumeCredential('credential-2', now, true, 'workspace-1')
        expect(tx.$executeRaw).toHaveBeenCalledTimes(3)
        const keys = tx.$executeRaw.mock.calls.map((call: any[]) => call[1])
        expect(new Set(keys).size).toBe(3)
    })

    it('blocks after the twentieth failed authentication and responds before token lookup', async () => {
        const { service, prisma } = fixture()
        for (let index = 0; index < 19; index++)
            await service.consumeFailedAuthentication('::ffff:192.0.2.1', now)
        await expect(service.consumeFailedAuthentication('192.0.2.1', now)).rejects.toBeInstanceOf(
            IntegrationRateLimitExceededError,
        )
        prisma.$queryRaw.mockResolvedValue([
            { blocked_until: new Date(now.getTime() + 900_000), checked_at: now },
        ])
        await expect(service.assertSourceAllowed('192.0.2.1', now)).rejects.toMatchObject({
            retryAfterSeconds: 900,
        })
    })

    it('shares the five-attempt step-up budget across workspaces, sessions, and operations', async () => {
        const { service } = fixture()
        for (let attempt = 0; attempt < 5; attempt++) {
            await service.consumeManagementStepUp('user-1', `192.0.2.${attempt + 1}`, now)
        }

        await expect(
            service.consumeManagementStepUp('user-1', '198.51.100.2', now),
        ).rejects.toMatchObject({ retryAfterSeconds: 900 })
    })

    it('shares the twenty-attempt step-up budget across users on one normalized source', async () => {
        const { service } = fixture()
        for (let attempt = 0; attempt < 20; attempt++) {
            await service.consumeManagementStepUp(`user-${attempt}`, '::ffff:192.0.2.1', now)
        }

        await expect(
            service.consumeManagementStepUp('another-user', '192.0.2.1', now),
        ).rejects.toMatchObject({ retryAfterSeconds: 900 })
    })

    it('releases the user step-up budget after its rolling window expires', async () => {
        const { service } = fixture()
        for (let attempt = 0; attempt < 5; attempt++)
            await service.consumeManagementStepUp('user-1', '192.0.2.1', now)

        await expect(
            service.consumeManagementStepUp(
                'user-1',
                '192.0.2.1',
                new Date(now.getTime() + 900_001),
            ),
        ).resolves.toBeUndefined()
    })

    it('fails closed when rate-limit storage is unavailable', async () => {
        const { service, prisma } = fixture()
        prisma.$transaction.mockRejectedValue(new Error('database unavailable'))
        await expect(service.consumeCredential('credential-1', now)).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        )
        await expect(
            service.consumeManagementStepUp('user-1', '192.0.2.1', now),
        ).rejects.toBeInstanceOf(ServiceUnavailableException)
    })
})
