import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { logger } from '../utils/logger'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
        logger.info('Initializing Prisma connection...', {
            context_name: PrismaService.name,
        })
        await this.$connect()
        logger.info('Prisma connected successfully.', {
            context_name: PrismaService.name,
        })
    }

    async onModuleDestroy() {
        logger.info('Closing Prisma connection...', {
            context_name: PrismaService.name,
        })
        await this.$disconnect()
    }
}
