import { Test, TestingModule } from '@nestjs/testing'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'

describe('HealthController', () => {
    let controller: HealthController

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [TerminusModule],
            controllers: [HealthController],
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

    it('should return ready status', () => {
        expect(controller.checkReady()).toBe('OK')
    })

    it('should return api health status', () => {
        const result = controller.checkApiHealth()
        expect(result.status).toBe('ok')
    })
})
