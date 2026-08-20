import { Type } from 'class-transformer'
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Length,
    Max,
    Min,
    Matches,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class BudgetBodyDto {
    @ApiProperty({ minimum: 0, exclusiveMinimum: true })
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @IsPositive()
    amount!: number

    @ApiPropertyOptional({ minLength: 3, maxLength: 3 })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    category_id!: string

    @ApiProperty({ minimum: 2000, maximum: 2100 })
    @IsInt()
    @Min(2000)
    @Max(2100)
    year!: number

    @ApiProperty({ minimum: 1, maximum: 12 })
    @IsInt()
    @Min(1)
    @Max(12)
    month!: number
}

export class ListBudgetsQueryDto {
    @ApiProperty({ minimum: 2000, maximum: 2100 })
    @Type(() => Number)
    @IsInt()
    @Min(2000)
    @Max(2100)
    year!: number

    @ApiProperty({ minimum: 1, maximum: 12 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month!: number
}

export class BudgetProgressQueryDto {
    @ApiProperty({ pattern: '^\\d{4}-\\d{2}$' })
    @Matches(/^\d{4}-\d{2}$/)
    month!: string
}
