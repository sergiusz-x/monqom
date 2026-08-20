import { IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateWorkspaceDto {
    @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(100)
    name?: string

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    timezone!: string

    @ApiPropertyOptional({ minLength: 3, maxLength: 3 })
    @IsOptional()
    @IsString()
    @Length(3, 3)
    base_currency?: string
}
