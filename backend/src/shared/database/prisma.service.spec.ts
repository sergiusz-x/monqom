import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from './prisma.service'

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: class {
            $connect = jest.fn()
            $disconnect = jest.fn()
        },
    }
})

describe('PrismaService', () => {
    let service: PrismaService

    beforeEach(async () => {
        process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
        const module: TestingModule = await Test.createTestingModule({
            providers: [PrismaService],
        }).compile()

        service = module.get<PrismaService>(PrismaService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should be defined', () => {
        expect(service).toBeDefined()
    })
})
