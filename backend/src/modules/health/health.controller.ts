import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

@Controller()
export class HealthController {
    constructor(private health: HealthCheckService) {}

    @Get('health')
    @HealthCheck()
    checkHealth() {
        // Here we can use this.health.check([ ... ]) for actual DB pinging later
        // Returning manual formatted response to match exact Acceptance Criteria
        return {
            status: 'healthy',
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
        }
    }

    @Get('ready')
    checkReady() {
        return 'OK'
    }
}
