import { Transform } from 'class-transformer'
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { transformBooleanQuery } from '../../shared/validation/query-transformers'
export class CategoriesQueryDto {
    @IsOptional() @Transform(transformBooleanQuery) @IsBoolean() include_archived?: boolean
}
export class CategoryBodyDto {
    @IsString() @IsNotEmpty() @MaxLength(100) name!: string
    @IsOptional() @IsString() @MaxLength(32) icon?: string | null
    @IsOptional() @IsString() parent_id?: string | null
}
export class CategoryOrderItemDto {
    @IsString() @IsNotEmpty() id!: string
}
export class CategoryOrderBodyDto {
    @IsArray() items!: CategoryOrderItemDto[]
}
