import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { PrismaService } from './../src/shared/database/prisma.service'

describe('Health endpoints (e2e)', () => {
    let app: INestApplication<App>

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PrismaService)
            .useValue({
                $connect: jest.fn(),
                $disconnect: jest.fn(),
            })
            .compile()

        app = moduleFixture.createNestApplication()
        await app.init()
    })

    afterEach(async () => {
        await app.close()
    })

    it('/health (GET)', async () => {
        const response = await request(app.getHttpServer()).get('/health').expect(200)

        expect(response.body).toEqual(
            expect.objectContaining({
                status: 'healthy',
                version: expect.any(String),
                uptime: expect.any(Number),
            }),
        )
    })

    it('/ready (GET)', () => {
        return request(app.getHttpServer()).get('/ready').expect(200).expect('OK')
    })
})
