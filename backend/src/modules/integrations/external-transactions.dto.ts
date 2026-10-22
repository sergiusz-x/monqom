import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateIf,
} from 'class-validator'

const DECIMAL_AMOUNT = /^\d+\.\d{2}$/

export class ExternalTransactionBodyDto {
    @ApiPropertyOptional({
        type: String,
        nullable: true,
        minLength: 1,
        maxLength: 200,
        description:
            'Case-sensitive source identity, trimmed, at most 200 UTF-8 bytes; null or omitted means no external identity.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    external_id?: string | null

    @ApiPropertyOptional({ enum: ['expense', 'income'], default: 'expense' })
    @ValidateIf((_object, value) => value !== undefined)
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

    @ApiPropertyOptional({ type: String, nullable: true })
    @IsOptional()
    @IsString()
    category_id?: string | null

    @ApiProperty()
    @IsString()
    payment_source_id!: string

    @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string | null

    @ApiPropertyOptional({ type: [String], maxItems: 10 })
    @ValidateIf((_object, value) => value !== undefined)
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    tags?: string[]
}
