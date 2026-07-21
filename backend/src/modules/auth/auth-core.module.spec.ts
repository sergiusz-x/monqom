import { Global, Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { SessionGuard } from '../../shared/guards/session.guard'
import { AuthCoreModule } from './auth-core.module'
import { AuthRepository } from './auth.repository'

@Global()
@Module({
    providers: [
        { provide: PrismaService, useValue: {} },
        { provide: AuditService, useValue: {} },
    ],
    exports: [PrismaService, AuditService],
})
class TestDatabaseModule {}

@Injectable()
class FirstAuthConsumer {
    constructor(
        readonly repository: AuthRepository,
        readonly guard: SessionGuard,
    ) {}
}

@Module({ imports: [AuthCoreModule], providers: [FirstAuthConsumer], exports: [FirstAuthConsumer] })
class FirstConsumerModule {}

@Injectable()
class SecondAuthConsumer {
    constructor(
        readonly repository: AuthRepository,
        readonly guard: SessionGuard,
    ) {}
}

@Module({
    imports: [AuthCoreModule],
    providers: [SecondAuthConsumer],
    exports: [SecondAuthConsumer],
})
class SecondConsumerModule {}

describe('AuthCoreModule', () => {
    it('shares repository and guard instances between consumer modules', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [TestDatabaseModule, FirstConsumerModule, SecondConsumerModule],
        }).compile()

        const first = moduleRef.get(FirstAuthConsumer)
        const second = moduleRef.get(SecondAuthConsumer)

        expect(first.repository).toBe(second.repository)
        expect(first.guard).toBe(second.guard)

        await moduleRef.close()
    })
})
