import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name)

    constructor() {
        const databaseUrl = process.env.DATABASE_URL

        if (!databaseUrl) {
            throw new Error('DATABASE_URL environment variable is required for PrismaService')
        }

        super({
            adapter: new PrismaPg({ connectionString: databaseUrl }),
        })
    }

    async onModuleInit() {
        this.logger.log('Initializing Prisma connection...')
        await this.$connect()
        this.logger.log('Prisma connected successfully.')
    }

    async onModuleDestroy() {
        this.logger.log('Closing Prisma connection...')
        await this.$disconnect()
    }
}
