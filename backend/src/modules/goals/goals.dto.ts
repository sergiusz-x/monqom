import { Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
    IsBoolean,
    IsIn,
    IsNumber,
    IsOptional,
    IsString,
    Length,
    Matches,
    Max,
    Min,
} from 'class-validator'

const MAX_MONEY = 21_474_836.47

export class CreateGoalDto {
    @ApiProperty({ example: 'Holiday', maxLength: 80 })
    @IsString()
    @Length(1, 80)
    name!: string

    @ApiProperty({ example: 12000, minimum: 0.01, maximum: MAX_MONEY })
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @Min(0.01)
    @Max(MAX_MONEY)
    target_amount!: number

    @ApiPropertyOptional({ example: 1500, minimum: 0, maximum: MAX_MONEY, default: 0 })
    @IsOptional()
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @Min(0)
    @Max(MAX_MONEY)
    initial_amount?: number

    @ApiProperty({ example: '2027-08-19', format: 'date' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    target_date!: string

    @ApiProperty({ example: false, default: false })
    @IsBoolean()
    include_current_month!: boolean
}

export class UpdateGoalDto {
    @ApiPropertyOptional({ example: 'Holiday', maxLength: 80 })
    @IsOptional()
    @IsString()
    @Length(1, 80)
    name?: string

    @ApiPropertyOptional({ example: 14000, minimum: 0.01, maximum: MAX_MONEY })
    @IsOptional()
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @Min(0.01)
    @Max(MAX_MONEY)
    target_amount?: number

    @ApiPropertyOptional({ example: 2000, minimum: 0, maximum: MAX_MONEY })
    @IsOptional()
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @Min(0)
    @Max(MAX_MONEY)
    initial_amount?: number

    @ApiPropertyOptional({ example: '2027-10-19', format: 'date' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    target_date?: string
}

export class ListGoalsQueryDto {
    @ApiPropertyOptional({ enum: ['true', 'false'], default: 'false' })
    @IsOptional()
    @Transform(({ value }) => (value === 'true' ? 'true' : value === 'false' ? 'false' : value))
    @IsIn(['true', 'false'])
    include_archived?: 'true' | 'false'
}

export class GoalOperationDto {
    @ApiProperty({ enum: ['deposit', 'withdrawal'] })
    @IsIn(['deposit', 'withdrawal'])
    type!: 'deposit' | 'withdrawal'

    @ApiProperty({ example: 250, minimum: 0.01, maximum: MAX_MONEY })
    @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
    @Min(0.01)
    @Max(MAX_MONEY)
    amount!: number

    @ApiProperty({ example: '2026-08-19', format: 'date' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    date!: string

    @ApiPropertyOptional({ example: 'Monthly transfer', maxLength: 500 })
    @IsOptional()
    @IsString()
    @Length(0, 500)
    note?: string
}
