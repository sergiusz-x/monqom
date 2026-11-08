import { Type } from 'class-transformer'
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsInt,
    IsIn,
    IsOptional,
    IsString,
    Length,
    Max,
    Min,
    ValidateNested,
} from 'class-validator'

export class ConfirmFundsDto {
    @IsInt()
    @Min(0)
    @Max(2147483647)
    funds_cents!: number

    @IsOptional()
    @IsIn(['manual', 'transactions'])
    income_mode?: 'manual' | 'transactions'

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(1, 128, { each: true })
    category_ids?: string[]

    @IsOptional()
    @IsInt()
    @Min(1)
    expected_revision?: number
}

class GoalAllocationDto {
    @IsString()
    @Length(1, 128)
    goal_id!: string

    @IsInt()
    @Min(1)
    @Max(2147483647)
    amount_cents!: number
}

export class SaveGoalAllocationsDto {
    @IsInt()
    @Min(0)
    expected_revision!: number

    @IsArray()
    @ArrayMaxSize(100)
    @ArrayUnique((allocation: GoalAllocationDto | null) => allocation?.goal_id)
    @ValidateNested({ each: true })
    @Type(() => GoalAllocationDto)
    allocations!: GoalAllocationDto[]

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @ArrayUnique()
    @IsString({ each: true })
    @Length(1, 128, { each: true })
    removed_allocation_ids?: string[]
}
