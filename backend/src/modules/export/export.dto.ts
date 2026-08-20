import { IsIn, IsOptional, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ExportTransactionsQueryDto {
    @ApiProperty({ enum: ['csv', 'json'] })
    @IsIn(['csv', 'json'])
    format!: 'csv' | 'json'

    @ApiPropertyOptional({ format: 'date' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_from?: string

    @ApiPropertyOptional({ format: 'date' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_to?: string
}
