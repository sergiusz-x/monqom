import { IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator'

export class UpdateWorkspaceDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(100)
    name?: string

    @IsString()
    @IsNotEmpty()
    timezone!: string

    @IsOptional()
    @IsString()
    @Length(3, 3)
    base_currency?: string
}
