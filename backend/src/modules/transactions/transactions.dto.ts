import { Transform, Type } from 'class-transformer'
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Length,
    Max,
    MaxLength,
    Min,
    Matches,
} from 'class-validator'
import { transformStringArrayQuery } from '../../shared/validation/query-transformers'

export class TransactionBodyDto {
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @IsPositive()
    amount!: number

    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string

    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date!: string

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    description!: string

    @IsString()
    @IsNotEmpty()
    category_id!: string

    @IsOptional()
    @IsString()
    notes?: string | null

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    tags?: string[]

    @IsString()
    @IsNotEmpty()
    payment_source_id!: string
}

export class ListTransactionsQueryDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    category_id?: string

    @IsOptional()
    @Transform(transformStringArrayQuery)
    @IsArray()
    @ArrayMaxSize(100)
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    category_ids?: string[]

    @IsOptional()
    @IsIn(['date', 'category', 'amount', 'description', 'notes', 'tags', 'payment_source'])
    sort_by?: 'date' | 'category' | 'amount' | 'description' | 'notes' | 'tags' | 'payment_source'

    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort_direction?: 'asc' | 'desc'

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    payment_source_id?: string

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    tag?: string

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_from?: string

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_to?: string

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number
}
