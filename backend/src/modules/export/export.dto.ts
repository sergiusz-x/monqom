import { IsIn, IsOptional, Matches } from 'class-validator'

export class ExportTransactionsQueryDto {
    @IsIn(['csv', 'json'])
    format!: 'csv' | 'json'

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_from?: string

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_to?: string
}
