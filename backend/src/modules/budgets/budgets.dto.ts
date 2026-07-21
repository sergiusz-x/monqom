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

export class BudgetBodyDto {
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @IsPositive()
    amount!: number

    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string

    @IsString()
    @IsNotEmpty()
    category_id!: string

    @IsInt()
    @Min(2000)
    @Max(2100)
    year!: number

    @IsInt()
    @Min(1)
    @Max(12)
    month!: number
}

export class ListBudgetsQueryDto {
    @Type(() => Number)
    @IsInt()
    @Min(2000)
    @Max(2100)
    year!: number

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month!: number
}

export class BudgetProgressQueryDto {
    @Matches(/^\d{4}-\d{2}$/)
    month!: string
}
