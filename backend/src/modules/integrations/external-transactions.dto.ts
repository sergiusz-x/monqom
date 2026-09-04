import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
} from 'class-validator'

const DECIMAL_AMOUNT = /^\d+\.\d{2}$/

export class ExternalTransactionBodyDto {
    @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    external_id?: string

    @ApiPropertyOptional({ enum: ['expense', 'income'], default: 'expense' })
    @IsOptional()
    @IsIn(['expense', 'income'])
    type?: 'expense' | 'income'

    @ApiProperty({ description: 'Positive fixed two-decimal amount string', example: '12.34' })
    @IsString()
    @Matches(DECIMAL_AMOUNT)
    amount!: string

    @ApiProperty({ example: 'PLN' })
    @IsString()
    @Matches(/^[A-Za-z]{3}$/)
    currency!: string

    @ApiProperty({ format: 'date' })
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date!: string

    @ApiProperty({ maxLength: 200 })
    @IsString()
    @MaxLength(200)
    description!: string

    @ApiProperty()
    @IsString()
    category_id!: string

    @ApiProperty()
    @IsString()
    payment_source_id!: string

    @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string | null

    @ApiPropertyOptional({ type: [String], maxItems: 10 })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    tags?: string[]
}
