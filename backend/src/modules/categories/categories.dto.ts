import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'
import { transformBooleanQuery } from '../../shared/validation/query-transformers'

export class CategoriesQueryDto {
    @IsOptional()
    @Transform(transformBooleanQuery)
    @IsBoolean()
    include_archived?: boolean
}
