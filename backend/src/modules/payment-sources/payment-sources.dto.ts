import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { transformBooleanQuery } from '../../shared/validation/query-transformers'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PaymentSourceBodyDto {
    @ApiProperty({ maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string

    @ApiProperty({ enum: ['cash', 'debit_card', 'credit_card', 'bank', 'other'] })
    @IsIn(['cash', 'debit_card', 'credit_card', 'bank', 'other'])
    type!: 'cash' | 'debit_card' | 'credit_card' | 'bank' | 'other'
}

export class ListPaymentSourcesQueryDto {
    @ApiPropertyOptional({ type: Boolean })
    @IsOptional()
    @Transform(transformBooleanQuery)
    @IsBoolean()
    include_archived?: boolean
}
