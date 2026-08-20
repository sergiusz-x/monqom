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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TransactionBodyDto {
    @ApiPropertyOptional({ enum: ['expense', 'income'] })
    @IsOptional()
    @IsIn(['expense', 'income'])
    type?: 'expense' | 'income'
    @ApiProperty({ minimum: 0, exclusiveMinimum: true })
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @IsPositive()
    amount!: number

    @ApiPropertyOptional({ minLength: 3, maxLength: 3 })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string

    @ApiProperty({ format: 'date' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date!: string

    @ApiProperty({ maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    description!: string

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    category_id!: string

    @ApiPropertyOptional({ nullable: true })
    @IsOptional()
    @IsString()
    notes?: string | null

    @ApiPropertyOptional({ type: [String], maxItems: 10 })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    tags?: string[]

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    payment_source_id!: string
}

export class ListTransactionsQueryDto {
    @ApiPropertyOptional({ enum: ['expense', 'income'] })
    @IsOptional()
    @IsIn(['expense', 'income'])
    type?: 'expense' | 'income'
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    category_id?: string

    @ApiPropertyOptional({ type: [String], maxItems: 100 })
    @IsOptional()
    @Transform(transformStringArrayQuery)
    @IsArray()
    @ArrayMaxSize(100)
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    category_ids?: string[]

    @ApiPropertyOptional({
        enum: ['date', 'category', 'amount', 'description', 'notes', 'tags', 'payment_source'],
    })
    @IsOptional()
    @IsIn(['date', 'category', 'amount', 'description', 'notes', 'tags', 'payment_source'])
    sort_by?: 'date' | 'category' | 'amount' | 'description' | 'notes' | 'tags' | 'payment_source'

    @ApiPropertyOptional({ enum: ['asc', 'desc'] })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort_direction?: 'asc' | 'desc'

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    payment_source_id?: string

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    tag?: string

    @ApiPropertyOptional({ format: 'date' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_from?: string

    @ApiPropertyOptional({ format: 'date' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date_to?: string

    @ApiPropertyOptional({ minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number

    @ApiPropertyOptional({ minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number
}
