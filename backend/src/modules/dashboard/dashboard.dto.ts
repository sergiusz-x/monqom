import { Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class DashboardMonthQueryDto {
    @ApiProperty({ pattern: '^\\d{4}-\\d{2}$' })
    @Matches(/^\d{4}-\d{2}$/)
    month!: string
}
