import { Transform } from 'class-transformer'
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator'
import { transformBooleanQuery } from '../../shared/validation/query-transformers'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
export class CategoriesQueryDto {
    @ApiPropertyOptional({ type: Boolean })
    @IsOptional()
    @Transform(transformBooleanQuery)
    @IsBoolean()
    include_archived?: boolean
    @ApiPropertyOptional({ enum: ['expense', 'income'] })
    @IsOptional()
    @IsIn(['expense', 'income'])
    type?: 'expense' | 'income'
}
export class CategoryBodyDto {
    @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100) name!: string
    @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 })
    @IsOptional()
    @IsString()
    @MaxLength(32)
    icon?: string | null
    @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsString() parent_id?:
        string | null
    @ApiPropertyOptional({ enum: ['expense', 'income'] })
    @IsOptional()
    @IsIn(['expense', 'income'])
    type?: 'expense' | 'income'
}
export class CategoryOrderItemDto {
    @ApiProperty() @IsString() @IsNotEmpty() id!: string
}
export class CategoryOrderBodyDto {
    @ApiProperty({ type: [CategoryOrderItemDto] }) @IsArray() items!: CategoryOrderItemDto[]
}
