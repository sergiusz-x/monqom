import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../shared/database/prisma.service'
import type { RuntimeConfig } from '../../config/env'

@Controller()
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {}

    @Get('health')
    @HealthCheck()
    checkHealth() {
        return {
            status: 'healthy',
            uptime: process.uptime(),
            version: this.getRuntimeConfig().appVersion,
        }
    }

    @Get('ready')
    async checkReady() {
        try {
            await this.prisma.$queryRaw`SELECT 1`
            return { status: 'ready' }
        } catch {
            throw new ServiceUnavailableException({ status: 'not_ready' })
        }
    }

    @Get('version.json')
    version() {
        const config = this.getRuntimeConfig()
        return { version: config.appVersion, sha: config.gitSha }
    }

    private getRuntimeConfig(): RuntimeConfig {
        const config = this.configService.get<RuntimeConfig>('env')
        if (!config) throw new Error('Runtime configuration is unavailable')
        return config
    }
}
