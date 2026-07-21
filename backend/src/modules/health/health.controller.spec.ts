import { Test, TestingModule } from '@nestjs/testing'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'
import { PrismaService } from '../../shared/database/prisma.service'
import { ConfigService } from '@nestjs/config'

describe('HealthController', () => {
    let controller: HealthController

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [TerminusModule],
            controllers: [HealthController],
            providers: [
                {
                    provide: PrismaService,
                    useValue: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue({ appVersion: 'test', gitSha: 'test' }),
                    },
                },
            ],
        }).compile()

        controller = module.get<HealthController>(HealthController)
    })

    it('should be defined', () => {
        expect(controller).toBeDefined()
    })

    it('should return health status', () => {
        const result = controller.checkHealth()
        expect(result.status).toBe('healthy')
        expect(result.version).toBeDefined()
    })

    it('should return ready status', async () => {
        await expect(controller.checkReady()).resolves.toEqual({ status: 'ready' })
    })
})
