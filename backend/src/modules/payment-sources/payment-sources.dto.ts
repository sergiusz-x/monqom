import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { transformBooleanQuery } from '../../shared/validation/query-transformers'

export class PaymentSourceBodyDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string

    @IsIn(['cash', 'debit_card', 'credit_card', 'bank', 'other'])
    type!: 'cash' | 'debit_card' | 'credit_card' | 'bank' | 'other'
}

export class ListPaymentSourcesQueryDto {
    @IsOptional()
    @Transform(transformBooleanQuery)
    @IsBoolean()
    include_archived?: boolean
}
